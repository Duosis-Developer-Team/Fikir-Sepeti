import { NextResponse } from "next/server";
import { azureConfigured, beginAzureLogin } from "@/lib/server/azure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/azure/start — Microsoft giriş sayfasına yönlendirir. */
export async function GET(req: Request) {
  if (!azureConfigured()) {
    // Yapılandırılmamışken sessizce başarısız olmak yerine açık söyle:
    // "Microsoft ile giriş" butonuna basan kullanıcı boş ekrana bakmasın.
    return NextResponse.json(
      { error: "Microsoft girişi bu kurulumda yapılandırılmamış." },
      { status: 503 }
    );
  }
  const redirectTo = new URL(req.url).searchParams.get("redirect_to");
  try {
    const url = await beginAzureLogin(req, redirectTo);
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    console.error("azure/start:", (err as Error).message);
    return NextResponse.json({ error: "Giriş başlatılamadı." }, { status: 500 });
  }
}
