-- Poll seçenekleri artık bağımsız fikir değil, kök fikre bağlı bir çocuk kayıt.

alter table idea_pool add column if not exists parent_idea_id uuid
  references idea_pool(id) on delete cascade;

create index if not exists idea_pool_parent_idx on idea_pool(parent_idea_id);

-- Geriye dönük: eski konvansiyonla (brief='Poll seçeneği') işaretlenmiş satırları,
-- aynı tenant'ta AYNI poll_closes_at değerine sahip (parent'tan miras alınan
-- kapanış zamanı) kök fikre bağla. Eşleşme kurulamıyorsa satır olduğu gibi
-- kalır — veri kaybı sıfır, sadece eski görünümde listelenmeye devam eder.
update idea_pool as opt
set parent_idea_id = parent.id
from idea_pool as parent
where opt.parent_idea_id is null
  and opt.brief = 'Poll seçeneği'
  and parent.id <> opt.id
  and parent.tenant_id = opt.tenant_id
  and parent.poll_closes_at = opt.poll_closes_at
  and parent.brief is distinct from 'Poll seçeneği';
