export const SLIDE_TEMPLATES: Record<string, string> = {

  // ═══════════════════════════════════════════════════════════
  // COVER — Capa escura com stripe diagonal + headline forte
  // ═══════════════════════════════════════════════════════════
  'cover-hero': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#0E0E0E;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.stripe{position:absolute;top:0;right:0;width:420px;height:100%;background:{{PRIMARY}};clip-path:polygon(30% 0,100% 0,100% 100%,0% 100%);}
.bg-num{position:absolute;top:-40px;right:60px;font-family:'Bebas Neue',sans-serif;font-size:520px;line-height:1;color:rgba(255,255,255,0.05);z-index:1;user-select:none;}
.tag{position:absolute;top:64px;left:64px;font-size:22px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.35);z-index:2;}
.headline{position:absolute;bottom:200px;left:64px;right:460px;z-index:2;}
.headline .pre{font-size:28px;font-weight:500;letter-spacing:2px;color:{{PRIMARY}};text-transform:uppercase;margin-bottom:8px;}
.headline h1{font-family:'Bebas Neue',sans-serif;font-size:140px;line-height:0.88;color:white;letter-spacing:2px;word-break:keep-all;overflow-wrap:normal;}
.sub{position:absolute;bottom:120px;left:64px;font-size:24px;color:rgba(255,255,255,0.45);font-weight:300;z-index:2;max-width:500px;line-height:1.5;}
.bottom{position:absolute;bottom:56px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:2;}
.swipe{font-size:18px;letter-spacing:4px;color:rgba(255,255,255,0.25);text-transform:uppercase;}
.badge{display:flex;align-items:center;gap:12px;}
.lamark{width:44px;height:44px;background:white;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:20px;color:{{PRIMARY}};}
.bname{font-size:20px;color:rgba(255,255,255,0.5);font-weight:500;}
</style></head><body>
<div class="stripe"></div>
<div class="bg-num">{{SLIDE_NUM}}</div>
<div class="tag">{{SLIDE_LABEL}}</div>
<div class="headline"><div class="pre">{{TIP_LABEL}}</div><h1>{{HEADLINE_L1}}<br>{{HEADLINE_L2}}</h1></div>
<div class="sub">{{BODY_TEXT}}</div>
<div class="bottom"><span class="swipe">— DESLIZE PARA VER</span><div class="badge"><div class="lamark">LA</div><span class="bname">{{BRAND_NAME}}</span></div></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // COVER-SPLIT — Capa com foto à direita (50/50 split)
  // ═══════════════════════════════════════════════════════════
  'cover-split': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#0E0E0E;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.photo-half{position:absolute;top:0;right:0;width:540px;height:100%;}
.photo-half img{width:100%;height:100%;object-fit:cover;}
.photo-overlay{position:absolute;top:0;right:0;width:540px;height:100%;background:linear-gradient(90deg,#0E0E0E 0%,rgba(14,14,14,0.3) 40%,transparent 100%);}
.tag{position:absolute;top:64px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:{{PRIMARY}};z-index:2;}
.num{position:absolute;top:64px;right:56px;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,0.3);z-index:2;}
.content{position:absolute;top:200px;left:64px;width:460px;z-index:2;}
.eyebrow{font-size:20px;font-weight:500;letter-spacing:4px;color:{{PRIMARY}};text-transform:uppercase;margin-bottom:16px;}
.h1{font-family:'Bebas Neue',sans-serif;font-size:120px;line-height:0.88;color:white;margin-bottom:32px;}
.body-p{font-size:26px;line-height:1.6;color:rgba(255,255,255,0.5);font-weight:300;}
.bottom{position:absolute;bottom:56px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:2;}
.swipe{font-size:18px;letter-spacing:4px;color:rgba(255,255,255,0.25);text-transform:uppercase;}
.badge{display:flex;align-items:center;gap:12px;}
.lamark{width:44px;height:44px;background:{{PRIMARY}};border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:20px;color:white;}
.bname{font-size:20px;color:rgba(255,255,255,0.5);font-weight:500;}
</style></head><body>
<div class="photo-half"><img src="{{PHOTO_URL}}" alt=""/></div>
<div class="photo-overlay"></div>
<div class="tag">{{SLIDE_LABEL}}</div>
<div class="num">{{SLIDE_NUM}}</div>
<div class="content">
<div class="eyebrow">{{TIP_LABEL}}</div>
<div class="h1">{{HEADLINE_L1}}<br>{{HEADLINE_L2}}</div>
<p class="body-p">{{BODY_TEXT}}</p>
</div>
<div class="bottom"><span class="swipe">— DESLIZE PARA VER</span><div class="badge"><div class="lamark">LA</div><span class="bname">{{BRAND_NAME}}</span></div></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // HEADLINE-BODY — Fundo claro, ícone, headline + body
  // ═══════════════════════════════════════════════════════════
  'headline-body': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#F5F2EE;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.top-bar{position:absolute;top:0;left:0;right:0;height:10px;background:{{PRIMARY}};}
.slide-num{position:absolute;top:40px;right:56px;font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:4px;color:#aaa;}
.icon-block{position:absolute;top:100px;left:64px;width:112px;height:112px;background:#0E0E0E;border-radius:28px;display:flex;align-items:center;justify-content:center;}
.icon-block svg{width:60px;height:60px;stroke:white;fill:none;stroke-width:1.5;}
.tip-label{position:absolute;top:128px;left:216px;font-size:20px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:{{PRIMARY}};}
.tip-title{position:absolute;top:164px;left:216px;font-family:'Bebas Neue',sans-serif;font-size:44px;color:#0E0E0E;letter-spacing:1px;}
.divider{position:absolute;top:280px;left:64px;right:64px;height:2px;background:rgba(0,0,0,0.1);}
.main-text{position:absolute;top:312px;left:64px;right:64px;}
.big{font-family:'Bebas Neue',sans-serif;font-size:104px;line-height:0.92;color:#0E0E0E;margin-bottom:40px;}
.big span{color:{{PRIMARY}};}
.body-p{font-size:28px;line-height:1.65;color:#555;font-weight:300;max-width:720px;}
.highlight-box{position:absolute;bottom:88px;left:64px;right:64px;background:#0E0E0E;border-radius:24px;padding:32px 40px;display:flex;align-items:center;gap:24px;}
.dot{width:16px;height:16px;background:{{PRIMARY}};border-radius:50%;flex-shrink:0;}
.highlight-box p{font-size:24px;color:rgba(255,255,255,0.7);font-weight:300;line-height:1.5;}
.highlight-box strong{color:white;font-weight:500;}
</style></head><body>
<div class="top-bar"></div>
<div class="slide-num">{{SLIDE_NUM}}</div>
<div class="icon-block"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="8"/><path d="M30 6v8M30 46v8M8 30H16M44 30h8M13 13l5.6 5.6M41.4 41.4l5.6 5.6M13 47l5.6-5.6M41.4 18.6l5.6-5.6"/></svg></div>
<div class="tip-label">{{TIP_LABEL}}</div>
<div class="tip-title">{{TIP_TITLE}}</div>
<div class="divider"></div>
<div class="main-text">
<div class="big">{{HEADLINE_L1}}<br><span>{{HEADLINE_L2}}</span></div>
<p class="body-p">{{BODY_TEXT}}</p>
</div>
<div class="highlight-box"><div class="dot"></div><p><strong>{{CARD_TITLE}}:</strong> {{CARD_TEXT}}</p></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // PHOTO-OVERLAY — Foto fullscreen com texto por cima
  // ═══════════════════════════════════════════════════════════
  'photo-overlay': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;background:#0E0E0E;}
.bg-photo{position:absolute;inset:0;}
.bg-photo img{width:100%;height:100%;object-fit:cover;}
.gradient{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.65) 55%,rgba(0,0,0,0.92) 100%);}
.num{position:absolute;top:56px;left:64px;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,0.4);z-index:2;}
.tag{position:absolute;top:56px;right:56px;background:{{PRIMARY}};color:white;font-size:18px;font-weight:700;letter-spacing:4px;text-transform:uppercase;padding:10px 24px;border-radius:200px;z-index:2;}
.content{position:absolute;bottom:120px;left:64px;right:64px;z-index:2;}
.eyebrow{font-size:20px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:{{PRIMARY}};margin-bottom:16px;}
.h1{font-family:'Bebas Neue',sans-serif;font-size:96px;line-height:0.92;color:white;margin-bottom:24px;}
.h1 span{color:{{PRIMARY}};}
.body-p{font-size:26px;line-height:1.6;color:rgba(255,255,255,0.7);font-weight:300;max-width:700px;}
.bottom{position:absolute;bottom:48px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:2;}
.brand{display:flex;align-items:center;gap:12px;}
.ldot{width:16px;height:16px;background:{{PRIMARY}};border-radius:50%;}
.bname{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:rgba(255,255,255,0.4);}
</style></head><body>
<div class="bg-photo"><img src="{{PHOTO_URL}}" alt=""/></div>
<div class="gradient"></div>
<div class="num">{{SLIDE_NUM}}</div>
<div class="tag">{{SLIDE_LABEL}}</div>
<div class="content">
<div class="eyebrow">{{TIP_LABEL}}</div>
<div class="h1">{{HEADLINE_L1}}<br><span>{{HEADLINE_L2}}</span></div>
<p class="body-p">{{BODY_TEXT}}</p>
</div>
<div class="bottom"><div class="brand"><div class="ldot"></div><span class="bname">{{BRAND_NAME}}</span></div></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // SPLIT-PHOTO-COPY — Foto à direita, copy à esquerda (conteúdo)
  // ═══════════════════════════════════════════════════════════
  'split-photo-copy': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#F5F2EE;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.photo-side{position:absolute;top:0;right:0;width:480px;height:100%;}
.photo-side img{width:100%;height:100%;object-fit:cover;}
.photo-fade{position:absolute;top:0;right:0;width:480px;height:100%;background:linear-gradient(90deg,#F5F2EE 0%,rgba(245,242,238,0.6) 15%,transparent 40%);}
.bar{position:absolute;top:0;left:0;width:8px;height:100%;background:{{PRIMARY}};}
.num{position:absolute;top:56px;left:48px;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:#ccc;z-index:2;}
.content{position:absolute;top:140px;left:48px;width:520px;z-index:2;}
.label{font-size:18px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:{{PRIMARY}};margin-bottom:12px;}
.h1{font-family:'Bebas Neue',sans-serif;font-size:88px;line-height:0.90;color:#0E0E0E;margin-bottom:32px;}
.h1 span{color:{{PRIMARY}};}
.divider{width:64px;height:3px;background:#0E0E0E;margin-bottom:32px;}
.body-p{font-size:26px;line-height:1.65;color:#555;font-weight:300;max-width:480px;}
.highlight-box{position:absolute;bottom:80px;left:48px;right:520px;z-index:2;}
.card{background:#0E0E0E;border-radius:20px;padding:28px 32px;display:flex;align-items:center;gap:20px;}
.cdot{width:14px;height:14px;background:{{PRIMARY}};border-radius:50%;flex-shrink:0;}
.card p{font-size:22px;color:rgba(255,255,255,0.7);font-weight:300;line-height:1.5;}
.card strong{color:white;font-weight:500;}
.footer{position:absolute;bottom:32px;left:48px;display:flex;align-items:center;gap:12px;z-index:2;}
.ldot{width:16px;height:16px;background:{{PRIMARY}};border-radius:50%;}
.brand{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:3px;color:#ccc;}
</style></head><body>
<div class="photo-side"><img src="{{PHOTO_URL}}" alt=""/></div>
<div class="photo-fade"></div>
<div class="bar"></div>
<div class="num">{{SLIDE_NUM}}</div>
<div class="content">
<div class="label">{{TIP_LABEL}}</div>
<div class="h1">{{HEADLINE_L1}}<br><span>{{HEADLINE_L2}}</span></div>
<div class="divider"></div>
<p class="body-p">{{BODY_TEXT}}</p>
</div>
<div class="highlight-box"><div class="card"><div class="cdot"></div><p><strong>{{CARD_TITLE}}:</strong> {{CARD_TEXT}}</p></div></div>
<div class="footer"><div class="ldot"></div><span class="brand">{{BRAND_NAME}}</span></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // CHECKLIST — Fundo claro, 3 itens com ícones
  // ═══════════════════════════════════════════════════════════
  'checklist': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#F5F2EE;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.corner{position:absolute;top:0;right:0;width:240px;height:240px;background:{{PRIMARY}};clip-path:polygon(100% 0,100% 100%,0 0);}
.num{position:absolute;top:52px;right:56px;font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:4px;color:rgba(255,255,255,0.8);}
.lbl{position:absolute;top:100px;left:64px;font-size:20px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:{{PRIMARY}};}
.h1{position:absolute;top:136px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:96px;line-height:0.92;color:#0E0E0E;}
.divider{position:absolute;top:330px;left:64px;right:64px;height:2px;background:rgba(0,0,0,0.08);}
.items{position:absolute;top:366px;left:64px;right:64px;display:flex;flex-direction:column;gap:36px;}
.item{display:flex;align-items:center;gap:32px;padding:28px 32px;background:white;border-radius:24px;border:1px solid rgba(0,0,0,0.06);}
.ibox{width:80px;height:80px;border-radius:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ibox svg{width:40px;height:40px;stroke-width:1.8;}
.ibox.pink{background:rgba(232,24,90,0.1);}
.ibox.pink svg{stroke:{{PRIMARY}};fill:none;}
.ibox.dark{background:#0E0E0E;}
.ibox.dark svg{stroke:white;fill:none;}
.ibox.gray{background:#F0EDE8;}
.ibox.gray svg{stroke:#666;fill:none;}
.ititle{font-size:26px;font-weight:700;color:#0E0E0E;margin-bottom:6px;}
.isub{font-size:20px;color:#888;font-weight:300;line-height:1.4;}
.footer{position:absolute;bottom:56px;left:64px;display:flex;align-items:center;gap:16px;}
.ldot{width:20px;height:20px;background:{{PRIMARY}};border-radius:50%;}
.brand{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:#bbb;}
</style></head><body>
<div class="corner"></div>
<div class="num">{{SLIDE_NUM}}</div>
<div class="lbl">{{SLIDE_LABEL}}</div>
<div class="h1">{{HEADLINE}}</div>
<div class="divider"></div>
<div class="items">
<div class="item"><div class="ibox pink"><svg viewBox="0 0 40 40"><path d="M8 20 C8 10 14 6 20 6 C26 6 32 10 32 20 C32 30 20 36 20 36 C20 36 8 30 8 20Z"/><circle cx="20" cy="18" r="5" fill="{{PRIMARY}}" stroke="none" opacity="0.4"/></svg></div><div><div class="ititle">{{ITEM1_TITLE}}</div><div class="isub">{{ITEM1_SUB}}</div></div></div>
<div class="item"><div class="ibox dark"><svg viewBox="0 0 40 40"><path d="M8 20 Q14 10 20 20 Q26 30 32 20"/><circle cx="20" cy="20" r="5" fill="white" stroke="none"/></svg></div><div><div class="ititle">{{ITEM2_TITLE}}</div><div class="isub">{{ITEM2_SUB}}</div></div></div>
<div class="item"><div class="ibox gray"><svg viewBox="0 0 40 40"><line x1="10" y1="20" x2="30" y2="20"/><polyline points="22,12 30,20 22,28"/><circle cx="10" cy="20" r="4" fill="#666" stroke="none"/></svg></div><div><div class="ititle">{{ITEM3_TITLE}}</div><div class="isub">{{ITEM3_SUB}}</div></div></div>
</div>
<div class="footer"><div class="ldot"></div><div class="brand">{{BRAND_NAME}}</div></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // STAT-HIGHLIGHT — Fundo escuro, número grande com glow
  // ═══════════════════════════════════════════════════════════
  'stat-highlight': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#0E0E0E;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.glow{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(232,24,90,0.2) 0%,transparent 65%);}
.ghost{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Bebas Neue',sans-serif;font-size:640px;line-height:1;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,0.04);user-select:none;white-space:nowrap;}
.top{position:absolute;top:64px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;}
.topnum{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,0.2);}
.dot{width:16px;height:16px;background:{{PRIMARY}};border-radius:50%;box-shadow:0 0 24px {{PRIMARY}};}
.stat{position:absolute;top:50%;left:64px;transform:translateY(-60%);}
.bignum{font-family:'Bebas Neue',sans-serif;font-size:240px;line-height:0.88;background:linear-gradient(180deg,white 0%,rgba(255,255,255,0.15) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.unit{font-family:'Bebas Neue',sans-serif;font-size:64px;color:{{PRIMARY}};letter-spacing:4px;display:block;margin-top:-16px;}
.desc{margin-top:32px;font-size:28px;line-height:1.7;color:rgba(255,255,255,0.5);font-weight:300;max-width:600px;}
.desc strong{color:rgba(255,255,255,0.85);font-weight:500;}
.bottom{position:absolute;bottom:64px;left:64px;right:64px;display:flex;align-items:center;gap:20px;}
.progress{flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;}
.fill{height:100%;width:65%;background:{{PRIMARY}};}
.brand{font-size:20px;color:rgba(255,255,255,0.2);font-weight:400;letter-spacing:3px;text-transform:uppercase;white-space:nowrap;}
</style></head><body>
<div class="glow"></div>
<div class="ghost">{{GHOST_WORD}}</div>
<div class="top"><span class="topnum">{{SLIDE_NUM}}</span><div class="dot"></div></div>
<div class="stat">
<div class="bignum">{{BIG_NUMBER}}</div>
<span class="unit">{{UNIT_LABEL}}</span>
<p class="desc">{{DESCRIPTION}} <strong>{{HIGHLIGHT}}</strong></p>
</div>
<div class="bottom"><div class="progress"><div class="fill"></div></div><span class="brand">{{BRAND_NAME}}</span></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // QUOTE-PROOF — Fundo escuro, quote grande com pills
  // ═══════════════════════════════════════════════════════════
  'quote-proof': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:#0A0A0A;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.topline{position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,{{PRIMARY}},transparent);}
.grid{position:absolute;top:0;right:0;width:400px;height:400px;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse at top right,black,transparent 70%);mask-image:radial-gradient(ellipse at top right,black,transparent 70%);}
.num{position:absolute;top:64px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.2);}
.qmark{position:absolute;top:104px;left:64px;font-family:'Bebas Neue',sans-serif;font-size:160px;line-height:0.6;color:{{PRIMARY}};opacity:0.7;}
.quote{position:absolute;top:200px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:88px;line-height:0.92;background:linear-gradient(180deg,white 40%,rgba(255,255,255,0.12) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:1px;}
.bar{position:absolute;top:536px;left:64px;width:80px;height:4px;background:{{PRIMARY}};}
.sub{position:absolute;top:572px;left:64px;right:64px;font-size:28px;color:rgba(255,255,255,0.45);font-weight:300;line-height:1.65;}
.pills{position:absolute;bottom:144px;left:64px;right:64px;display:flex;gap:24px;align-items:center;flex-wrap:wrap;}
.pill{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:200px;padding:16px 28px;}
.pill svg{width:28px;height:28px;stroke:{{PRIMARY}};fill:none;stroke-width:2;flex-shrink:0;}
.pill span{font-size:22px;color:rgba(255,255,255,0.5);}
.bottom{position:absolute;bottom:56px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;}
.brand{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,0.15);}
.arr{width:56px;height:56px;border:1px solid rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;}
.arr svg{width:24px;height:24px;stroke:rgba(255,255,255,0.3);fill:none;stroke-width:2;}
</style></head><body>
<div class="topline"></div><div class="grid"></div>
<div class="num">{{SLIDE_NUM}}</div>
<div class="qmark">&ldquo;</div>
<div class="quote">{{QUOTE_L1}}<br>{{QUOTE_L2}}<br>{{QUOTE_L3}}</div>
<div class="bar"></div>
<p class="sub">{{SUBTEXT}}</p>
<div class="pills">
<div class="pill"><svg viewBox="0 0 28 28"><polygon points="14,3 17,10 24,10 18,15 20,22 14,18 8,22 10,15 4,10 11,10"/></svg><span>{{PILL1}}</span></div>
<div class="pill"><svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="11"/><path d="M14 9v5l3 3"/></svg><span>{{PILL2}}</span></div>
</div>
<div class="bottom"><span class="brand">{{BRAND_NAME}}</span><div class="arr"><svg viewBox="0 0 24 24"><polyline points="5,12 19,12 15,8M19,12 15,16"/></svg></div></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // PHOTO-QUOTE — Foto fullscreen com quote por cima
  // ═══════════════════════════════════════════════════════════
  'photo-quote': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;background:#0E0E0E;}
.bg-photo{position:absolute;inset:0;}
.bg-photo img{width:100%;height:100%;object-fit:cover;filter:brightness(0.4) contrast(1.1);}
.top{position:absolute;top:56px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:2;}
.num{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,0.4);}
.dot{width:16px;height:16px;background:{{PRIMARY}};border-radius:50%;box-shadow:0 0 20px {{PRIMARY}};}
.center{position:absolute;top:50%;left:64px;right:64px;transform:translateY(-50%);z-index:2;text-align:center;}
.qmark{font-family:'Bebas Neue',sans-serif;font-size:140px;line-height:0.5;color:{{PRIMARY}};opacity:0.6;margin-bottom:24px;}
.quote{font-family:'Bebas Neue',sans-serif;font-size:80px;line-height:0.92;color:white;letter-spacing:1px;margin-bottom:32px;}
.bar{width:80px;height:4px;background:{{PRIMARY}};margin:0 auto 28px;}
.sub{font-size:26px;color:rgba(255,255,255,0.6);font-weight:300;line-height:1.6;max-width:700px;margin:0 auto;}
.bottom{position:absolute;bottom:56px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:2;}
.brand{display:flex;align-items:center;gap:12px;}
.ldot{width:16px;height:16px;background:{{PRIMARY}};border-radius:50%;}
.bname{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:rgba(255,255,255,0.3);}
</style></head><body>
<div class="bg-photo"><img src="{{PHOTO_URL}}" alt=""/></div>
<div class="top"><span class="num">{{SLIDE_NUM}}</span><div class="dot"></div></div>
<div class="center">
<div class="qmark">&ldquo;</div>
<div class="quote">{{QUOTE_L1}}<br>{{QUOTE_L2}}<br>{{QUOTE_L3}}</div>
<div class="bar"></div>
<p class="sub">{{SUBTEXT}}</p>
</div>
<div class="bottom"><div class="brand"><div class="ldot"></div><span class="bname">{{BRAND_NAME}}</span></div></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // CTA-END — Cor primária, CTA forte com botão
  // ═══════════════════════════════════════════════════════════
  'cta-end': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;background:{{PRIMARY}};font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;}
.ghost{position:absolute;bottom:-60px;left:-20px;font-family:'Bebas Neue',sans-serif;font-size:360px;line-height:1;color:rgba(0,0,0,0.1);letter-spacing:-8px;user-select:none;white-space:nowrap;}
.circles{position:absolute;top:-80px;right:-80px;width:400px;height:400px;border:1px solid rgba(255,255,255,0.1);border-radius:50%;}
.circles::after{content:"";position:absolute;top:80px;left:80px;right:80px;bottom:80px;border:1px solid rgba(255,255,255,0.1);border-radius:50%;}
.num{position:absolute;top:64px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.4);}
.eyebrow{position:absolute;top:116px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.5);}
.h1{position:absolute;top:160px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:140px;line-height:0.88;color:white;}
.sub{position:absolute;top:620px;left:64px;right:64px;font-size:28px;line-height:1.7;color:rgba(255,255,255,0.8);font-weight:300;max-width:560px;}
.btn{position:absolute;bottom:200px;left:64px;background:white;color:{{PRIMARY}};padding:28px 56px;border-radius:200px;font-size:26px;font-weight:700;letter-spacing:1px;display:inline-flex;align-items:center;gap:16px;}
.btnarr{width:40px;height:40px;background:{{PRIMARY}};border-radius:50%;display:flex;align-items:center;justify-content:center;}
.btnarr svg{width:20px;height:20px;stroke:white;fill:none;stroke-width:2.5;}
.badge{position:absolute;bottom:72px;right:64px;display:flex;align-items:center;gap:16px;background:rgba(0,0,0,0.15);padding:16px 28px;border-radius:200px;}
.lamark{width:48px;height:48px;background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:22px;color:{{PRIMARY}};letter-spacing:1px;}
.bname{font-size:22px;color:rgba(255,255,255,0.8);font-weight:500;}
</style></head><body>
<div class="ghost">{{GHOST_WORD}}</div>
<div class="circles"></div>
<div class="num">{{SLIDE_NUM}}</div>
<div class="eyebrow">{{EYEBROW}}</div>
<div class="h1">{{H1_L1}}<br>{{H1_L2}}<br>{{H1_L3}}</div>
<p class="sub">{{SUBTEXT}}</p>
<div class="btn">{{CTA_TEXT}}<div class="btnarr"><svg viewBox="0 0 20 20"><polyline points="5,10 15,10 12,7M15,10 12,13"/></svg></div></div>
<div class="badge"><div class="lamark">LA</div><span class="bname">{{BRAND_NAME}}</span></div>
</body></html>`,

  // ═══════════════════════════════════════════════════════════
  // CTA-PHOTO-END — CTA com foto de fundo
  // ═══════════════════════════════════════════════════════════
  'cta-photo-end': `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1350px;font-family:'DM Sans',sans-serif;position:relative;overflow:hidden;background:{{PRIMARY}};}
.bg-photo{position:absolute;inset:0;}
.bg-photo img{width:100%;height:100%;object-fit:cover;opacity:0.25;}
.overlay{position:absolute;inset:0;background:linear-gradient(180deg,{{PRIMARY}} 0%,rgba(0,0,0,0.3) 100%);}
.num{position:absolute;top:64px;left:64px;font-size:20px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.4);z-index:2;}
.eyebrow{position:absolute;top:116px;left:64px;font-size:22px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.6);z-index:2;}
.h1{position:absolute;top:180px;left:64px;right:64px;font-family:'Bebas Neue',sans-serif;font-size:130px;line-height:0.88;color:white;z-index:2;}
.sub{position:absolute;top:600px;left:64px;right:64px;font-size:28px;line-height:1.7;color:rgba(255,255,255,0.85);font-weight:300;max-width:560px;z-index:2;}
.btn{position:absolute;bottom:200px;left:64px;background:white;color:{{PRIMARY}};padding:28px 56px;border-radius:200px;font-size:26px;font-weight:700;letter-spacing:1px;display:inline-flex;align-items:center;gap:16px;z-index:2;}
.btnarr{width:40px;height:40px;background:{{PRIMARY}};border-radius:50%;display:flex;align-items:center;justify-content:center;}
.btnarr svg{width:20px;height:20px;stroke:white;fill:none;stroke-width:2.5;}
.badge{position:absolute;bottom:72px;right:64px;display:flex;align-items:center;gap:16px;background:rgba(0,0,0,0.2);padding:16px 28px;border-radius:200px;z-index:2;}
.lamark{width:48px;height:48px;background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:22px;color:{{PRIMARY}};letter-spacing:1px;}
.bname{font-size:22px;color:rgba(255,255,255,0.85);font-weight:500;}
</style></head><body>
<div class="bg-photo"><img src="{{PHOTO_URL}}" alt=""/></div>
<div class="overlay"></div>
<div class="num">{{SLIDE_NUM}}</div>
<div class="eyebrow">{{EYEBROW}}</div>
<div class="h1">{{H1_L1}}<br>{{H1_L2}}<br>{{H1_L3}}</div>
<p class="sub">{{SUBTEXT}}</p>
<div class="btn">{{CTA_TEXT}}<div class="btnarr"><svg viewBox="0 0 20 20"><polyline points="5,10 15,10 12,7M15,10 12,13"/></svg></div></div>
<div class="badge"><div class="lamark">LA</div><span class="bname">{{BRAND_NAME}}</span></div>
</body></html>`,

}
