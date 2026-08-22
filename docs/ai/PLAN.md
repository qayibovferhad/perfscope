# AI-ni ən üst səviyyəyə çıxarmaq

## Hazırkı vəziyyət (ölçülmüş, təxmin yox)

Bu sessiyada AI bir karddan bütün məhsula yayıldı, ziddiyyətlər bir analiz çağırışı ilə
aradan qalxdı, səs birləşdi. Amma sonuncu ölçü problemi göstərir:

```
landau.cubicsbms.com — 4 fix:
  ● "Split /app/app.js into smaller chunks…"          ← konkret
  ○ "Remove user-scalable=no… add missing alt…"      ← istənilən sayta uyğun
  ○ "Add language attributes to your root HTML…"     ← istənilən sayta uyğun
  ○ "Fix your heading hierarchy… darken text…"       ← istənilən sayta uyğun
```

**4-dən 1-i** konkret sübuta istinad edir. Səbəb texnikidir, model deyil: `AuditItem` yalnız
`id / title / description / score` daşıyır. Lighthouse-un `details.items`-i — hansı element,
hansı selektor, hansı snippet — `lhr-transform.ts`-də **atılır**. Model elementi adlandıra
bilmir, çünki onu heç vaxt görmür.

Bu, "AI-ni yaxşılaşdırmaq" deyil, **AI-yə sübutu vermək** məsələsidir.

## Prinsip

Hər mərhələnin bir ölçüsü var və o ölçü mərhələdən **əvvəl** işlədilir. Konkretlik ölçüsü
(fix-lərin neçəsi fayl / selektor / kitabxana / funksiya adlandırır) hər addımdan sonra
təkrar çəkilir. Rəqəm qalxmırsa, addım işləməyib.

---

## Mərhələ 1 — Sübut (ən böyük təsir, ~1 gün)

**1a. Audit detallarını saxla.** `lhr-transform.ts` hər failing audit üçün ilk 5
`details.items`-i saxlasın: selektor, snippet, URL, dəyər. `AuditItem.details?: AuditDetail[]`.
Bu, `fullResult`-u böyüdür — ölç, 5 ilə məhdudlaşdır, ehtiyac olsa 3-ə düş.

**1b. Prompt bunu göstərsin.** `analysePage` hər failing auditlə birlikdə elementlərini
versin: `color-contrast — 12 elements, e.g. "p.hint" #6f8278 on #111d16 (4.24:1)`.

**Ölçü:** konkretlik 1/4 → hədəf ≥ 3/4. Eyni fixture, eyni probe.

**Nəyə görə birinci:** başqa hər şey buna dayanır. Sübutsuz model ümumi danışacaq,
prompt nə qədər yaxşı olsa da.

## Mərhələ 2 — Yaddaş (~1 gün)

AI hər auditi **sıfırdan** görür. Bir dəfə "app.js-i böl" deyib, sonra 6 audit boyu
təkrar deyəcək, istifadəçi onu görməzdən gəlsə belə.

**2a. Tövsiyə tarixçəsi.** `AiRecommendation` kolleksiyası: `{ userId, url, fingerprint,
firstSeenAt, lastSeenAt, timesGiven, resolvedAt }`. Fingerprint = normallaşdırılmış fix
mətni + toxunduğu fayl/selektor.

**2b. Prompt keçmişi görsün.** "Bu tövsiyəni 4 dəfə vermisən, hələ həll olunmayıb —
ya başqa cür izah et, ya prioriteti dəyiş, ya də etiraf et ki, bu, çətin dəyişiklikdir."
Həll olunanlar (fingerprint artıq çıxmır) qeyd olunsun: "Keçən dəfə tövsiyə etdiyin X
düzəlib — bunu de."

**Ölçü:** eyni səhifənin ardıcıl 3 auditində fix-lərin təkrar nisbəti. Hədəf: 3-cü
auditdə ≤ 1 təkrar, və ən azı bir "bu düzəldi" cümləsi.

## Mərhələ 3 — Nəticəni bağla (~yarım gün)

Advisor "audit et" deyir, istifadəçi edir — və AI **nəticəni heç vaxt bilmir**.

**3a. Action-ların izi.** Advisor action-ına kliklənəndə `{ actionId, kind, url, at }`
yazılsın. Növbəti audit gələndə: "sən 2 saat əvvəl 'audit et' demişdin, istifadəçi etdi,
LCP 3.3s → 2.1s düşdü." Advisor bunu birinci cümlə etsin.

**3b. Hədəf tarixçəsi.** Targets tab-ında AI: "3 audit əvvəl LCP 4.0s idi, indi 3.3s —
bu sürətlə hədəfə (2.0s) ~5 audit qalıb." `forecast.ts` artıq var, ona AI şərhi qoş.

**Ölçü:** advisor-un ardıcıl açılışlarında "əvvəlki tövsiyənin nəticəsi" cümləsinin
olub-olmaması.

## Mərhələ 4 — Sual ver (~1 gün)

Bütün AI **monoloqdur**. İstifadəçi "niyə?" soruşa bilmir.

**4a. Analyzer-də sual qutusu.** AiCard-ın altında bir sətir: "Bu barədə soruş".
Cavab **yalnız həmin auditin datası** üzərində — `analysePage`-in gördüyü eyni kontekst
+ sual. Ümumi chat deyil, bu səhifənin danışan versiyasıdır.

**4b. Sual tarixçəsi saxlanmasın** — 6 saatlıq cache kifayətdir, hər sual bir çağırışdır.
Sonsuz sual = sonsuz xərc; ilk versiyada audit başına 5 sual limiti.

**Ölçü:** işlədirmi (probe), və cavab kontekstdən kənara çıxmır (dataya olmayan bir şey
soruşanda "bu auditdə o məlumat yoxdur" deyir).

## Mərhələ 5 — Model seçimi (~yarım gün, amma ölçüdən sonra)

Hər şey `gemini-flash-lite-latest`-dədir — ən ucuz, ən zəif. Advisor və `analysePage`
kimi "düşünmə" tələb edən çağırışlar üçün `gemini-flash-latest` və ya `pro` sınansın.

**Amma yalnız 1–2-dən sonra**: sübutu görməyən güclü model də ümumi danışacaq. Əvvəl
sübutu ver, sonra modeli qaldır, hər dəfə eyni probe ilə ölç. Fərq yoxdursa, ucuzda qal.

**Ölçü:** eyni fixture, iki model, konkretlik + təkrar nisbəti yan-yana.

## Mərhələ 6 — Genişlənmə (davamlı)

Bunlar 1–5 bitəndən sonra, hər biri kiçik:
- **Extension popup**: `analysis:insights`-i dinləmir (`analysisSocket.ts:48`), yəni
  extension-da AI yoxdur. Bir kart.
- **CLI report** (`--output report`): diaqnozu + fix-ləri çap edir, amma per-audit
  izahlarını yox.
- **Public share report** (`/report/:token`): saxlanılmış AI-ni göstərir, amma advisor
  yoxdur — orada olmamalıdır (auth yoxdur), amma "bu hesabatı paylaşan üçün AI xülasəsi"
  bir sətir ola bilər.

---

## Nə ETMİRİK

- **Ümumi chatbot.** "PerfScope ilə söhbət et" — kontekstsiz, xərcli, və məhsulun
  gücü olan konkretliyi itirir. 4a bunun əksidir: yalnız bir audit üzərində.
- **Real-vaxt streaming.** Cavablar 2–4 saniyədir, skeleton var. Streaming mürəkkəblik
  gətirir, hiss olunan fayda azdır.
- **Fine-tuning.** Data yoxdur (51 audit), və 1-ci mərhələ eyni faydanı promptla verir.

## Sıra və səbəb

```
1  Sübut      ← hər şey buna dayanır; ölçülə bilən ən böyük sıçrayış
2  Yaddaş     ← "hər dəfə eyni" şikayətinin əsl həlli
3  Nəticə     ← AI-nin dəyərini istifadəçiyə sübut edir ("dediyimi etdin, işlədi")
4  Sual       ← monoloqdan dialoqa
5  Model      ← yalnız ölçdükdən sonra
6  Genişlənmə ← qalan səthlər
```

Hər mərhələ ayrıca commit, ayrıca probe, ayrıca ölçü. 1-i bitirib rəqəmi göstərmədən
2-yə keçmirəm.

---

## Mərhələ 5 — ölçüldü (2026-08-22)

`probes/model-tier.probe.mts` (yeni) eyni saxlanmış auditi bir neçə modeldən keçirir və
`ai-quality.probe.mts`-in öz balını oxuyur — bal bir yerdə yazılıb, iki probe ayrılıqda
saymır. Model artıq `GEMINI_MODEL` env dəyişəni ilə seçilir (`config.geminiModel`).

Fixture `testlandau.cubicsbms.com`, hər model 2 dəfə (hər dəfə ayrı proses — eyni prosesdə
prompt cache eyni mətni qaytarardı və heç nə ölçməzdi):

```
  model                       fixes concrete  audits concrete  latency   tokens (in/out)
  gemini-flash-lite-latest    5.0 of 5.5      8.0 of 14.0      3.6s      2260 / 900
  gemini-flash-latest         503 — high demand, 2 cəhddən 2-si
  gemini-3.5-flash-lite       5.0 of 5.5      8.0 of 14.0      3.2s      2260 / 836
  gemini-3.5-flash            5.5 of 6.0      8.5 of 14.0      18.4s     2260 / 1003
```

**Qərar: ucuz tierdə qalırıq.** Mərhələ 1-in sübutu işlədikdən sonra lite artıq fix-lərin
~91%-ni konkret yazır; ən güclü mövcud tier bunu yarım fix qaldırır və gecikməni 3.6s →
18.4s edir — analyzer-də adam skeleton-a baxır. `gemini-pro-latest` bu açarda 429
(kvota), yəni onu sınamaq üçün əvvəlcə billing lazımdır.

**Ölçmənin yan məhsulu — düzəldildi.** `generate()`-də retry yox idi; `gemini-flash-latest`
ardıcıl iki dəfə 503 ("high demand") verdi. Canlı auditdə bu, həmin promptun çıxışını
həmişəlik itirir, çünki AI yazı vaxtı yaradılır və sənədə yazılır — bir daha soruşan yoxdur.
İndi 429/5xx və şəbəkə xətaları üçün bir əlavə cəhd var (1.5s backoff); 400/403/404 təkrar
edilmir, ikinci dəfə eyni cavabı verəcək. Vaxt hesabı **bütöv çağırışa** aiddir, cəhd başına
yox: `timeoutMs` adamın gözlədiyi müddətdir, ayrıca 45s verilən retry məhz onu ikiqat edərdi.
`UsageTally`-yə `retries`/`failures` əlavə olundu — çağıran tərəf xətanı bir sətir yazıb null
ilə davam etdiyi üçün, sayğac olmasa yük altında əzilən model sadəcə sükut kimi görünür.
Yoxlama: `probes/ai-retry.probe.mts` (503 → bərpa, 400 → təkrar yoxdur, qısa deadline →
retry başlamır) — 11/11 PASS, ikinci cəhd real API-yə gedir.

## (c) Regressiya alert-lərində səbəb (2026-08-22)

Alert yalnız rəqəmləri daşıyırdı, ona görə AI qeydi də yalnız rəqəmi təkrar edə bilirdi —
"LCP pisləşdi, şəkillərinizi yoxlayın", hansı monitorinq alətinin dediyi. İndi alert
müqayisə etdiyi runla arasındakı **resurs fərqini** daşıyır (`Alert.evidence`), qeyd isə
səbəbi yalnız o siyahıdan adlandıra bilər.

Yeni kod az oldu, çünki hər şey artıq var idi: `getPreviousRun` (analyzer istifadə edirdi)
və `diffResources`. `analysePage`-in içindəki formatlama `lib/resourceDiff.ts`-ə
`formatResourceDiff` kimi çıxarıldı — iki formatlayıcı ayrılsa, alert səbəbi səhifənin
özündən fərqli dildə təsvir edərdi.

**Yan effekt, bilərəkdən:** regression.service öz `findPreviousRun`-unu atıb ortaq
`getPreviousRun`-a keçdi. Ortaq olan `HAS_RESULT_FILTER` tətbiq edir, yəni **sıfır balla
uğursuz run artıq müqayisə bazası olmur**. Əvvəl uğursuz bir run regressiyanı gizlədirdi
(sıfırla müqayisədə hər şey yaxşılaşma görünür).

Ölçü — `probes/regression-cause.probe.mts`, 8/8 PASS:
```
resurs dəyişib : "…waiting 4.60s … because /hero.jpg grew to 918KB. Check your image
                  optimization pipeline…"          ← faylı adlandırır
resurs eynidir : "…waiting nearly five seconds … Check the main hero image or script…"
                                                   ← uydurma fayl adı YOXDUR
```
Probe qeyddəki hər fayl adını səhifənin real resurs siyahısı ilə tutuşdurur; uydurulmuş ad
testi qırır. `evidence` webhook gövdəsinə düşmür — səbəbin yeri qeyddir, gövdədə dəyişmiş
faylların siyahısı əsas tapıntını basardı.
