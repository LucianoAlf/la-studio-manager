/**
 * HTML templates fixos para cada layout_type do carrossel.
 * Placeholders: PRIMARY_COLOR, SLIDE_NUM, HEADLINE_L1, HEADLINE_L2, BODY_TEXT, etc.
 * Substituídos programaticamente antes de enviar ao Browserless.
 */

export const SLIDE_TEMPLATES: Record<string, string> = {

'headline-body': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#F5F2EE;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.corner{position:absolute;top:0;right:0;width:320px;height:320px;background:PRIMARY_COLOR;clip-path:polygon(100% 0,100% 100%,0 0);}
.num{position:absolute;top:52px;left:64px;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:#bbb;}
.lbl{position:absolute;top:110px;left:64px;font-size:18px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:PRIMARY_COLOR;}
.h1{position:absolute;top:148px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:148px;line-height:0.88;color:#0E0E0E;}
.acc{color:PRIMARY_COLOR;}
.divider{position:absolute;top:520px;left:64px;right:64px;height:2px;background:rgba(0,0,0,0.1);}
.body{position:absolute;top:548px;left:64px;right:64px;font-size:32px;line-height:1.65;color:#555;font-weight:300;max-width:780px;}
.card{position:absolute;bottom:0;left:0;right:0;height:220px;background:#0E0E0E;display:flex;align-items:center;padding:0 64px;gap:28px;}
.dot{width:18px;height:18px;background:PRIMARY_COLOR;border-radius:50%;flex-shrink:0;}
.card p{font-size:28px;color:rgba(255,255,255,0.7);line-height:1.5;font-weight:300;}
.card strong{color:white;font-weight:500;}
</style></head><body>
<div class="corner"></div>
<div class="num">SLIDE_NUM</div>
<div class="lbl">SLIDE_LABEL</div>
<div class="h1">HEADLINE_L1<br><span class="acc">HEADLINE_L2</span></div>
<div class="divider"></div>
<p class="body">BODY_TEXT</p>
<div class="card"><div class="dot"></div><p><strong>CARD_TITLE:</strong> CARD_TEXT</p></div>
</body></html>`,

'checklist': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#F5F2EE;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.corner{position:absolute;top:0;right:0;width:240px;height:240px;background:PRIMARY_COLOR;clip-path:polygon(100% 0,100% 100%,0 0);}
.num{position:absolute;top:52px;left:64px;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:#bbb;}
.lbl{position:absolute;top:104px;left:64px;font-size:18px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:PRIMARY_COLOR;}
.h1{position:absolute;top:136px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:96px;line-height:0.92;color:#0E0E0E;}
.divider{position:absolute;top:330px;left:64px;right:64px;height:2px;background:rgba(0,0,0,0.08);}
.items{position:absolute;top:360px;left:64px;right:64px;display:flex;flex-direction:column;gap:36px;}
.item{display:flex;align-items:center;gap:32px;padding:28px 32px;background:white;border-radius:24px;border:1px solid rgba(0,0,0,0.06);}
.ibox{width:80px;height:80px;border-radius:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ibox svg{width:40px;height:40px;stroke-width:1.8;}
.ibox.pink{background:rgba(232,24,90,0.1);}
.ibox.pink svg{stroke:PRIMARY_COLOR;fill:none;}
.ibox.dark{background:#0E0E0E;}
.ibox.dark svg{stroke:white;fill:none;}
.ibox.gray{background:#F0EDE8;}
.ibox.gray svg{stroke:#666;fill:none;}
.ititle{font-size:26px;font-weight:700;color:#0E0E0E;margin-bottom:6px;}
.isub{font-size:20px;color:#888;font-weight:300;line-height:1.4;}
.footer{position:absolute;bottom:56px;left:64px;display:flex;align-items:center;gap:16px;}
.ldot{width:20px;height:20px;background:PRIMARY_COLOR;border-radius:50%;}
.brand{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:#bbb;}
</style></head><body>
<div class="corner"></div>
<div class="num">SLIDE_NUM</div>
<div class="lbl">SLIDE_LABEL</div>
<div class="h1">HEADLINE</div>
<div class="divider"></div>
<div class="items">
<div class="item"><div class="ibox pink"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14"/><path d="M20 12v8l5 5"/></svg></div><div><div class="ititle">ITEM1_TITLE</div><div class="isub">ITEM1_SUB</div></div></div>
<div class="item"><div class="ibox dark"><svg viewBox="0 0 40 40"><path d="M8 20 Q14 10 20 20 Q26 30 32 20"/><circle cx="20" cy="20" r="4" fill="white" stroke="none"/></svg></div><div><div class="ititle">ITEM2_TITLE</div><div class="isub">ITEM2_SUB</div></div></div>
<div class="item"><div class="ibox gray"><svg viewBox="0 0 40 40"><line x1="10" y1="20" x2="30" y2="20"/><polyline points="22,12 30,20 22,28"/></svg></div><div><div class="ititle">ITEM3_TITLE</div><div class="isub">ITEM3_SUB</div></div></div>
</div>
<div class="footer"><div class="ldot"></div><div class="brand">LA MUSIC SCHOOL</div></div>
</body></html>`,

'stat-highlight': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#0E0E0E;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(232,24,90,0.18) 0%,transparent 65%);}
.ghost{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Bebas Neue',sans-serif;font-size:640px;line-height:1;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,0.04);user-select:none;white-space:nowrap;}
.top{position:absolute;top:64px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;}
.topnum{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,0.2);}
.dot{width:16px;height:16px;background:PRIMARY_COLOR;border-radius:50%;box-shadow:0 0 24px PRIMARY_COLOR;}
.stat{position:absolute;top:50%;left:64px;transform:translateY(-60%);}
.bignum{font-family:'Bebas Neue',sans-serif;font-size:240px;line-height:0.9;background:linear-gradient(180deg,white 0%,rgba(255,255,255,0.2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.unit{font-family:'Bebas Neue',sans-serif;font-size:64px;color:PRIMARY_COLOR;letter-spacing:4px;display:block;margin-top:-16px;}
.desc{margin-top:32px;font-size:28px;line-height:1.7;color:rgba(255,255,255,0.5);font-weight:300;max-width:600px;}
.desc strong{color:rgba(255,255,255,0.85);font-weight:500;}
.bottom{position:absolute;bottom:64px;left:64px;right:64px;display:flex;align-items:center;gap:20px;}
.progress{flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;}
.fill{height:100%;width:65%;background:PRIMARY_COLOR;}
.brand{font-size:20px;color:rgba(255,255,255,0.2);font-weight:400;letter-spacing:3px;text-transform:uppercase;white-space:nowrap;}
</style></head><body>
<div class="glow"></div>
<div class="ghost">GHOST_WORD</div>
<div class="top"><span class="topnum">SLIDE_NUM</span><div class="dot"></div></div>
<div class="stat">
<div class="bignum">BIG_NUMBER</div>
<span class="unit">UNIT_LABEL</span>
<p class="desc">DESCRIPTION</p>
</div>
<div class="bottom"><div class="progress"><div class="fill"></div></div><span class="brand">LA Music School</span></div>
</body></html>`,

'quote-proof': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#0A0A0A;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.topline{position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,PRIMARY_COLOR,transparent);}
.grid{position:absolute;top:0;right:0;width:400px;height:400px;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse at top right,black,transparent 70%);mask-image:radial-gradient(ellipse at top right,black,transparent 70%);}
.num{position:absolute;top:64px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.2);}
.qmark{position:absolute;top:104px;left:64px;font-family:'Bebas Neue',sans-serif;font-size:160px;line-height:0.6;color:PRIMARY_COLOR;opacity:0.7;}
.quote{position:absolute;top:200px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:88px;line-height:0.92;background:linear-gradient(180deg,white 40%,rgba(255,255,255,0.15) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:1px;}
.bar{position:absolute;top:536px;left:64px;width:80px;height:4px;background:PRIMARY_COLOR;}
.sub{position:absolute;top:572px;left:64px;right:64px;font-size:28px;color:rgba(255,255,255,0.45);font-weight:300;line-height:1.65;}
.pills{position:absolute;bottom:144px;left:64px;right:64px;display:flex;gap:24px;align-items:center;flex-wrap:wrap;}
.pill{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:200px;padding:16px 28px;}
.pill svg{width:28px;height:28px;stroke:PRIMARY_COLOR;fill:none;stroke-width:2;flex-shrink:0;}
.pill span{font-size:22px;color:rgba(255,255,255,0.5);}
.bottom{position:absolute;bottom:56px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;}
.brand{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,0.15);}
.arr{width:56px;height:56px;border:1px solid rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;}
.arr svg{width:24px;height:24px;stroke:rgba(255,255,255,0.3);fill:none;stroke-width:2;}
</style></head><body>
<div class="topline"></div><div class="grid"></div>
<div class="num">SLIDE_NUM</div>
<div class="qmark">&ldquo;</div>
<div class="quote">QUOTE_TEXT</div>
<div class="bar"></div>
<p class="sub">SUBTEXT</p>
<div class="pills">
<div class="pill"><svg viewBox="0 0 28 28"><polygon points="14,3 17,10 24,10 18,15 20,22 14,18 8,22 10,15 4,10 11,10"/></svg><span>PILL1</span></div>
<div class="pill"><svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="11"/><path d="M14 9v5l3 3"/></svg><span>PILL2</span></div>
</div>
<div class="bottom"><span class="brand">LA MUSIC SCHOOL</span><div class="arr"><svg viewBox="0 0 24 24"><polyline points="5,12 19,12 15,8M19,12 15,16"/></svg></div></div>
</body></html>`,

'cta-end': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:PRIMARY_COLOR;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.ghost{position:absolute;bottom:-60px;left:-20px;font-family:'Bebas Neue',sans-serif;font-size:360px;line-height:1;color:rgba(0,0,0,0.1);letter-spacing:-8px;user-select:none;white-space:nowrap;}
.circles{position:absolute;top:-80px;right:-80px;width:400px;height:400px;border:1px solid rgba(255,255,255,0.1);border-radius:50%;}
.circles::after{content:"";position:absolute;top:80px;left:80px;right:80px;bottom:80px;border:1px solid rgba(255,255,255,0.1);border-radius:50%;}
.num{position:absolute;top:64px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.4);}
.eyebrow{position:absolute;top:116px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.5);}
.h1{position:absolute;top:160px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:140px;line-height:0.88;color:white;}
.sub{position:absolute;top:620px;left:64px;right:64px;font-size:28px;line-height:1.7;color:rgba(255,255,255,0.8);font-weight:300;max-width:560px;}
.btn{position:absolute;bottom:200px;left:64px;background:white;color:PRIMARY_COLOR;padding:28px 56px;border-radius:200px;font-size:26px;font-weight:700;letter-spacing:1px;display:inline-flex;align-items:center;gap:16px;}
.btnarr{width:40px;height:40px;background:PRIMARY_COLOR;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.btnarr svg{width:20px;height:20px;stroke:white;fill:none;stroke-width:2.5;}
.badge{position:absolute;bottom:72px;right:64px;display:flex;align-items:center;gap:16px;background:rgba(0,0,0,0.15);padding:16px 28px;border-radius:200px;}
.lamark{width:48px;height:48px;background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:22px;color:PRIMARY_COLOR;letter-spacing:1px;}
.bname{font-size:22px;color:rgba(255,255,255,0.8);font-weight:500;}
</style></head><body>
<div class="ghost">GHOST_WORD</div>
<div class="circles"></div>
<div class="num">SLIDE_NUM</div>
<div class="eyebrow">EYEBROW</div>
<div class="h1">H1_L1<br>H1_L2<br>H1_L3</div>
<p class="sub">SUBTEXT</p>
<div class="btn">CTA_TEXT<div class="btnarr"><svg viewBox="0 0 20 20"><polyline points="5,10 15,10 12,7M15,10 12,13"/></svg></div></div>
<div class="badge"><div class="lamark">LA</div><span class="bname">BRAND_NAME</span></div>
</body></html>`,

}
