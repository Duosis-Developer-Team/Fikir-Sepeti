import "server-only";

import type { PoolClient } from "pg";
import { withIdentity } from "./pg";

/**
 * PostgREST uyumlu ince sorgu kurucu — Supabase istemcisinin sunucu tarafındaki
 * yerine geçer.
 *
 * NEDEN SHIM, NEDEN 32 ROUTE'U SQL'E ÇEVİRMEK DEĞİL:
 * Migration'larda verilen kararın aynısı. Ölçüm (grep): 281 sorgu zinciri var
 * ama yalnızca 17 farklı metot kullanılıyor ve hepsi mekanik. Route'ları elle
 * SQL'e çevirmek (a) 281 yerde yeni hata riski, (b) ekibin yazacağı her yeni
 * route için tekrarlanan bir çeviri borcu demekti. Bu dosya ~1 kez yazılıyor,
 * route'lar değişmiyor ve yeni route'lar da çalışıyor.
 *
 * DESTEKLENEN YÜZEY bilinçli olarak DAR — kodda gerçekten kullanılanlar:
 *   from · select · insert · update · upsert · delete
 *   eq · neq · in · is · ilike · gt · gte · lt · lte · or
 *   order · limit · range · single · maybeSingle
 *   select("*", { count: "exact", head: true })
 * Desteklenmeyen bir girdi (ör. or() içinde bilinmeyen operatör) SESSİZCE
 * yok sayılmıyor: sorgu hiç çalışmıyor ve `error` dolu dönüyor.
 *
 * GÜVENLİK: her terminal sorgu withIdentity() içinde koşuyor, yani RLS
 * devrede ve çağıranın kimliğiyle. Değerler DAİMA parametreleştiriliyor;
 * tanımlayıcılar (tablo/kolon) beyaz listeye uyan bir kalıba zorlanıyor.
 */

export type PgRestError = {
  message: string;
  /** Postgres SQLSTATE — kodda `error.code !== "23505"` gibi kontroller var. */
  code: string | null;
  details: string | null;
};

/**
 * `data` bilerek `any`.
 *
 * Supabase'in TİPSİZ istemcisi (`SupabaseClient<any>`) de tam olarak böyle
 * davranıyordu ve 32 route handler o davranışa göre yazıldı: `data.tenant_id`
 * gibi erişimler doğrudan yapılıyor, ara cast yok. Burada satır tipini
 * daraltmak, shim'in bütün amacını (route'lara dokunmamak) bozar ve 100'den
 * fazla yere cast eklemek gerekirdi. Tip güvenliği route sınırında zaten
 * `lib/types.ts` ile sağlanıyor.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PgRestResult<T = any> = {
  data: T;
  error: PgRestError | null;
  count: number | null;
  status: number;
};

// Tanımlayıcı kalıbı: harf/rakam/alt çizgi. Bu dosyadaki tüm tablo ve kolon
// adları kendi kaynak kodumuzdan geliyor, ama kalıp yine de zorlanıyor —
// ileride bir değişken oraya sızarsa enjeksiyon değil, hata olsun.
const IDENT = /^[a-z_][a-z0-9_]*$/i;

function ident(name: string, kind: "tablo" | "kolon"): string {
  if (!IDENT.test(name)) {
    throw new Error(`Geçersiz ${kind} adı: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

/** `select("id, tenant_id")` → `"id","tenant_id"` ; `select("*")` → `*` */
function columnList(spec: string): string {
  const trimmed = spec.trim();
  if (trimmed === "*" || trimmed === "") return "*";
  return trimmed
    .split(",")
    .map((c) => ident(c.trim(), "kolon"))
    .join(", ");
}

function toError(err: unknown): PgRestError {
  const e = err as { message?: string; code?: string; detail?: string };
  return {
    message: e?.message ?? String(err),
    code: e?.code ?? null,
    details: e?.detail ?? null,
  };
}

type Filter =
  | { kind: "cmp"; column: string; op: string; value: unknown }
  | { kind: "in"; column: string; values: unknown[] }
  | { kind: "is"; column: string; value: null | boolean }
  | { kind: "raw"; sql: string; params: unknown[] };

type Mode =
  | { type: "select" }
  | { type: "insert"; rows: Record<string, unknown>[] }
  | { type: "update"; patch: Record<string, unknown> }
  | { type: "upsert"; rows: Record<string, unknown>[]; onConflict: string[] }
  | { type: "delete" };

// Varsayılan `any[]` — Supabase'in tipsiz istemcisiyle AYNI. `any` olsaydı
// `rows.map((r) => ...)` çağrılarındaki `r` örtük any sayılıp noImplicitAny
// altında 29 route'ta hata verirdi; dizi tipi bunu doğal olarak çözüyor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Builder<T = any[]> implements PromiseLike<PgRestResult<T>> {
  private filters: Filter[] = [];
  private columns = "*";
  private orderBy: { column: string; ascending: boolean }[] = [];
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private mode: Mode = { type: "select" };
  private wantSingle: "one" | "maybe" | null = null;
  private returning = false;
  private countMode: "exact" | null = null;
  private headOnly = false;
  /** Zincir kurulurken oluşan hata — execute()'ta sonuç nesnesine dönüşür. */
  private deferredError: Error | null = null;

  constructor(
    private table: string,
    private run: <R>(fn: (client: PoolClient) => Promise<R>) => Promise<R>
  ) {}

  // ── seçim / mutasyon ──────────────────────────────────────────────────────

  select(spec = "*", opts?: { count?: "exact"; head?: boolean }): this {
    this.columns = columnList(spec);
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    // insert/update/delete sonrası .select() = RETURNING
    if (this.mode.type !== "select") this.returning = true;
    return this;
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = { type: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.mode = { type: "update", patch };
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string }
  ): this {
    this.mode = {
      type: "upsert",
      rows: Array.isArray(rows) ? rows : [rows],
      onConflict: (opts?.onConflict ?? "id").split(",").map((c) => c.trim()),
    };
    return this;
  }

  delete(): this {
    this.mode = { type: "delete" };
    return this;
  }

  // ── filtreler ─────────────────────────────────────────────────────────────

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "=", value });
    return this;
  }
  neq(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "<>", value });
    return this;
  }
  gt(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: ">", value });
    return this;
  }
  gte(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: ">=", value });
    return this;
  }
  lt(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "<", value });
    return this;
  }
  lte(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "<=", value });
    return this;
  }
  ilike(column: string, value: string): this {
    this.filters.push({ kind: "cmp", column, op: "ilike", value });
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: "in", column, values });
    return this;
  }
  is(column: string, value: null | boolean): this {
    this.filters.push({ kind: "is", column, value });
    return this;
  }

  /**
   * PostgREST `or` sözdiziminin kodda kullanılan alt kümesi:
   *   "tenant_id.is.null,tenant_id.eq.<uuid>"
   * Sadece `.is.null` ve `.eq.<değer>` destekleniyor — kodda geçen tek kalıp.
   * Başka bir operatör gelirse sessizce yok saymak yerine hata veriliyor.
   */
  or(expression: string): this {
    const parts = expression.split(",");
    const clauses: string[] = [];
    const params: unknown[] = [];
    for (const part of parts) {
      const [column, op, ...rest] = part.split(".");
      const value = rest.join(".");
      if (op === "is" && value === "null") {
        clauses.push(`${ident(column, "kolon")} is null`);
      } else if (op === "eq") {
        clauses.push(`${ident(column, "kolon")} = ?`);
        params.push(value);
      } else {
        // Zincir metodundan SENKRON fırlatmak, route handler'da yakalanmayan
        // bir istisnaya (500) dönüşürdü. Diğer tüm hatalar gibi sonuç
        // nesnesinde dönsün diye erteleniyor — çağıran kod `error`'a zaten
        // bakıyor. Yine de sessiz değil: sorgu hiç çalışmıyor.
        this.deferredError = new Error(
          `or(): desteklenmeyen ifade parçası: ${JSON.stringify(part)}`
        );
        return this;
      }
    }
    this.filters.push({ kind: "raw", sql: `(${clauses.join(" or ")})`, params });
    return this;
  }

  // ── sıralama / sayfalama ──────────────────────────────────────────────────

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderBy.push({ column, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number): this {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }

  // single/maybeSingle sonuç tipini diziden TEK satıra daraltıyor; `this`
  // döndüğü için jenerik parametre cast ile değiştiriliyor (Supabase de
  // aynı daraltmayı tip düzeyinde yapıyor).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single(): Builder<any> {
    this.wantSingle = "one";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as unknown as Builder<any>;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle(): Builder<any> {
    this.wantSingle = "maybe";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as unknown as Builder<any>;
  }

  // ── derleme ───────────────────────────────────────────────────────────────

  private where(params: unknown[]): string {
    if (!this.filters.length) return "";
    const parts = this.filters.map((f) => {
      if (f.kind === "cmp") {
        params.push(f.value);
        return `${ident(f.column, "kolon")} ${f.op} $${params.length}`;
      }
      if (f.kind === "in") {
        // Boş dizi: PostgREST `in.()` hiçbir satır döndürmez. `= any('{}')` de
        // aynı şeyi yapar ama okunurluk için açıkça yazıldı.
        if (!f.values.length) return "false";
        params.push(f.values);
        return `${ident(f.column, "kolon")} = any($${params.length})`;
      }
      if (f.kind === "is") {
        return f.value === null
          ? `${ident(f.column, "kolon")} is null`
          : `${ident(f.column, "kolon")} is ${f.value ? "true" : "false"}`;
      }
      // raw: `?` yer tutucularını sıradaki $n'e çevir
      let sql = f.sql;
      for (const p of f.params) {
        params.push(p);
        sql = sql.replace("?", `$${params.length}`);
      }
      return sql;
    });
    return ` where ${parts.join(" and ")}`;
  }

  private tail(params: unknown[]): string {
    let sql = "";
    if (this.orderBy.length) {
      sql +=
        " order by " +
        this.orderBy
          .map((o) => `${ident(o.column, "kolon")} ${o.ascending ? "asc" : "desc"}`)
          .join(", ");
    }
    if (this.limitN != null) {
      params.push(this.limitN);
      sql += ` limit $${params.length}`;
    }
    if (this.offsetN != null) {
      params.push(this.offsetN);
      sql += ` offset $${params.length}`;
    }
    return sql;
  }

  private build(): { sql: string; params: unknown[] } {
    const table = ident(this.table, "tablo");
    const params: unknown[] = [];

    if (this.mode.type === "select") {
      if (this.headOnly && this.countMode) {
        return { sql: `select count(*)::int as count from ${table}${this.where(params)}`, params };
      }
      const sql = `select ${this.columns} from ${table}${this.where(params)}${this.tail(params)}`;
      return { sql, params };
    }

    if (this.mode.type === "insert" || this.mode.type === "upsert") {
      const rows = this.mode.rows;
      if (!rows.length) throw new Error("insert/upsert: satır yok");
      // Kolon kümesi ilk satırdan; PostgREST de böyle davranır ve kodda tüm
      // toplu eklemeler homojen.
      const cols = Object.keys(rows[0]);
      if (!cols.length) throw new Error("insert/upsert: kolon yok");
      const colSql = cols.map((c) => ident(c, "kolon")).join(", ");
      const values = rows
        .map(
          (row) =>
            `(${cols
              .map((c) => {
                params.push(row[c] ?? null);
                return `$${params.length}`;
              })
              .join(", ")})`
        )
        .join(", ");
      let sql = `insert into ${table} (${colSql}) values ${values}`;
      if (this.mode.type === "upsert") {
        const conflict = this.mode.onConflict.map((c) => ident(c, "kolon")).join(", ");
        const updates = cols
          .filter((c) => !(this.mode as { onConflict: string[] }).onConflict.includes(c))
          .map((c) => `${ident(c, "kolon")} = excluded.${ident(c, "kolon")}`);
        sql += updates.length
          ? ` on conflict (${conflict}) do update set ${updates.join(", ")}`
          : ` on conflict (${conflict}) do nothing`;
      }
      if (this.returning || this.wantSingle) sql += ` returning ${this.columns}`;
      return { sql, params };
    }

    if (this.mode.type === "update") {
      const patch = this.mode.patch;
      const cols = Object.keys(patch);
      if (!cols.length) throw new Error("update: değişecek kolon yok");
      const sets = cols.map((c) => {
        params.push(patch[c] ?? null);
        return `${ident(c, "kolon")} = $${params.length}`;
      });
      let sql = `update ${table} set ${sets.join(", ")}${this.where(params)}`;
      if (this.returning || this.wantSingle) sql += ` returning ${this.columns}`;
      return { sql, params };
    }

    // delete
    let sql = `delete from ${table}${this.where(params)}`;
    if (this.returning || this.wantSingle) sql += ` returning ${this.columns}`;
    return { sql, params };
  }

  // ── çalıştırma ────────────────────────────────────────────────────────────

  private async execute(): Promise<PgRestResult<T>> {
    if (this.deferredError) {
      return { data: null as T, error: toError(this.deferredError), count: null, status: 400 };
    }
    let sql: string;
    let params: unknown[];
    try {
      ({ sql, params } = this.build());
    } catch (err) {
      return { data: null as T, error: toError(err), count: null, status: 400 };
    }

    try {
      const rows = await this.run((client) => client.query(sql, params as never[]));
      const result = rows as unknown as { rows: Record<string, unknown>[] };

      if (this.headOnly && this.countMode) {
        const count = Number(result.rows[0]?.count ?? 0);
        return { data: null as T, error: null, count, status: 200 };
      }

      if (this.wantSingle === "one") {
        if (result.rows.length !== 1) {
          return {
            data: null as T,
            error: {
              // PostgREST'in .single() hatasıyla aynı SQLSTATE: çağıran kod
              // bazı yerlerde koda bakıyor.
              message: `Beklenen 1 satır, gelen ${result.rows.length}`,
              code: "PGRST116",
              details: null,
            },
            count: null,
            status: 406,
          };
        }
        return { data: result.rows[0] as T, error: null, count: null, status: 200 };
      }

      if (this.wantSingle === "maybe") {
        return {
          data: (result.rows[0] ?? null) as T,
          error: null,
          count: null,
          status: 200,
        };
      }

      return {
        data: result.rows as T,
        error: null,
        count: this.countMode ? result.rows.length : null,
        status: 200,
      };
    } catch (err) {
      return { data: null as T, error: toError(err), count: null, status: 400 };
    }
  }

  // await edilebilir olması Supabase davranışının aynısı.
  then<R1 = PgRestResult<T>, R2 = never>(
    onfulfilled?: ((value: PgRestResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export type Db = {
  from: (table: string) => Builder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<PgRestResult>;
};

/**
 * Bir kimliğe bağlı veritabanı erişimi. Her terminal sorgu kendi
 * transaction'ında ve `SET LOCAL app.user_email` altında koşuyor —
 * PostgREST'in istek başına transaction davranışıyla aynı.
 */
/**
 * Verilen çalıştırıcı üstünde bir Db kurar. Kimliğin nasıl belirlendiğini
 * (ve hangi bağlantıyla çalışıldığını) çağıran seçer — uygulama RLS'li app
 * rolüyle, testler/seed sahip rolüyle bağlanıyor.
 */
export function makeDb(
  run: <R>(fn: (client: PoolClient) => Promise<R>) => Promise<R>
): Db {
  return {
    from: (table: string) => new Builder(table, run),
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      const names = Object.keys(args ?? {});
      const params = names.map((n) => (args as Record<string, unknown>)[n]);
      const call = names.length
        ? `select * from ${ident(fn, "tablo")}(${names
            .map((n, i) => `${ident(n, "kolon")} => $${i + 1}`)
            .join(", ")})`
        : `select * from ${ident(fn, "tablo")}()`;
      try {
        const res = await run((client) => client.query(call, params as never[]));
        const rows = (res as unknown as { rows: Record<string, unknown>[] }).rows;
        // Skaler dönen fonksiyonlar (resolve_tenant_for_claims gibi) tek
        // kolonlu tek satır verir; Supabase bunu düz değer olarak döndürüyor.
        if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
          return { data: Object.values(rows[0])[0], error: null, count: null, status: 200 };
        }
        return { data: rows, error: null, count: null, status: 200 };
      } catch (err) {
        return { data: null, error: toError(err), count: null, status: 400 };
      }
    },
  };
}

export function dbForIdentity(
  email: string | null | (() => Promise<string | null>)
): Db {
  // Kimlik tembel de verilebiliyor: route'lar `const sb = getDb(req)` diye
  // SENKRON çağırıyor, ama kimliği çözmek asenkron. Çözüm bir kez yapılıp
  // saklanıyor — aynı istekte her sorgu için tekrar tekrar çözülmüyor.
  let cached: Promise<string | null> | null = null;
  const resolve = (): Promise<string | null> => {
    if (typeof email !== "function") return Promise.resolve(email);
    cached ??= email();
    return cached;
  };
  const run = async <R,>(fn: (client: PoolClient) => Promise<R>) =>
    withIdentity(await resolve(), fn);

  return makeDb(run);
}
