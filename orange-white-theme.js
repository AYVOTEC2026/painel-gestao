(function(){
  const frame=document.getElementById('appFrame');
  if(!frame)return;
  const STYLE_ID='ayvo-orange-white-final';
  const FLAG='data-foodpark-login-v2';

  function install(d){
    const old=d.getElementById(STYLE_ID);if(old)old.remove();
    const s=d.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      :root{--bg:#fbf5ef!important;--panel:#fff!important;--panel2:#fffaf6!important;--ink:#261a12!important;--muted:#7d6c60!important;--line:#efddcf!important;--line2:#e6d0be!important;--dark:#fff!important;--dark2:#fffaf6!important;--blue:#a05433!important;--blue2:#8a4426!important;--blue-soft:#f7ece5!important;--blue-line:#e8cbbb!important;--amber:#8a4426!important;--amber-soft:#f7ece5!important;--shadow:0 1px 3px rgba(64,30,8,.05),0 10px 28px rgba(64,30,8,.06)!important}
      html,body,.app,main{background:#fbf5ef!important;color:#261a12!important}
      .hidden,.login.hidden,#loginScreen.hidden{display:none!important}
      aside{background:#fff!important;color:#38271c!important;border-right:1px solid #efddcf!important;box-shadow:8px 0 28px rgba(94,48,15,.035)!important}.brand b{color:#2c1d14!important}.brand small{color:#9a6a55!important}.brand .brandmark{background:#f7ece5!important;border:1px solid #e8cbbb!important;color:#8a4426!important}
      .nav-group-label{color:#a87660!important}.nav button{color:#6d5a4d!important}.nav button:hover{background:#f7ece5!important;color:#8a4426!important}.nav button.active{background:linear-gradient(90deg,#f7ece5,#faf4ef)!important;color:#8a4426!important;box-shadow:inset 3px 0 0 #a05433!important}.nav button.active .ico{color:#a05433!important}
      .topbar{background:rgba(251,245,239,.97)!important;border-bottom:1px solid #efddcf!important}.topbar .ey{color:#8a4426!important}.topbar h1{color:#241b14!important}.subtitle{color:#806f63!important}
      .cmd-btn,.cmd-icon{background:#fff!important;border-color:#ecd8c8!important;color:#4d392b!important}.cmd-btn.primary,.btn.primary{background:#a05433!important;border-color:#a05433!important;color:#fff!important;box-shadow:none!important}.cmd-btn.primary:hover,.btn.primary:hover{background:#874023!important}
      .card,.exec-kpi,.row,.unit,.day,.stage,.deal,.doc,.toolbar,.table-wrap{background:#fff!important;border-color:#efddcf!important}.stat:before{background:#a05433!important}.bar i,.bc i{background:linear-gradient(90deg,#c27454,#a05433)!important}.btn.soft,.info,.round{background:#f7ece5!important;color:#8a4426!important;border-color:#e8cbbb!important}.slot{background:#f7ece5!important;border-color:#e8cbbb!important}input,select,textarea{border-color:#ead7c8!important;background:#fff!important}input:focus,select:focus,textarea:focus{border-color:#c9937a!important;box-shadow:0 0 0 3px rgba(160,84,51,.12)!important}
      .login{min-height:100vh!important;display:grid!important;grid-template-columns:minmax(0,1.02fr) minmax(420px,.98fr)!important;background:#fbf5ef!important;color:#241b14!important}
      .login-hero{position:relative!important;overflow:hidden!important;padding:34px!important;background:#4a362d!important;color:#fff!important;display:flex!important;align-items:flex-end!important}.login-hero:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(35,18,8,.55),rgba(35,18,8,.18) 48%,rgba(35,18,8,.04));z-index:2}.login-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(150deg,#6b4c3e 0%,#513b32 55%,#33251f 100%);z-index:1;opacity:.98}
      .login-brand,.login-copy,.login-foot{position:relative;z-index:3}.login-hero{flex-direction:column!important;align-items:flex-start!important;justify-content:space-between!important}.login-brand{display:block!important;padding:0!important;background:none!important;border:0!important}.login-logo{display:block;width:210px;aspect-ratio:300/244;object-fit:cover;border-radius:20px;box-shadow:0 18px 40px rgba(0,0,0,.28)}
      .login-copy{max-width:500px!important;margin-top:0!important}.login-copy .ey{display:inline-block!important;color:#ffe8d0!important;font-size:9.5px!important;font-weight:800!important;letter-spacing:.16em!important;margin:0 0 12px!important}.login-copy h1{margin:0 0 10px!important;max-width:480px!important;color:#fff!important;font-size:42px!important;line-height:1.04!important;letter-spacing:-.045em!important;font-weight:820!important}.login-copy p{max-width:470px!important;margin:0!important;color:#fff3e8!important;font-size:15px!important;line-height:1.5!important}.fp-strip,.login-points,.fp-scene{display:none!important}.login-foot{color:#ffe4ca!important;font-size:10.5px!important;margin-top:16px!important}
      .login-panel{position:relative!important;background:#fffdfb!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:38px 34px!important;border-left:1px solid #efddcf!important;box-shadow:-28px 0 60px rgba(98,52,18,.05)!important}.login-box{width:min(405px,100%)!important;background:#fff!important;border:1px solid #efddcf!important;border-radius:22px!important;padding:28px 26px!important;box-shadow:0 18px 40px rgba(85,47,17,.06)!important}.login-box:before{display:none!important;content:""!important}.login-box h2{margin:0 0 8px!important;color:#241b14!important;font-size:32px!important;line-height:1.05!important;letter-spacing:-.038em!important;font-weight:820!important}.login-box p{margin:0 0 20px!important;color:#7d6d62!important;font-size:13.5px!important;line-height:1.55!important}.field{margin-bottom:11px!important}.field label{font-size:10.5px!important;color:#846d5d!important;font-weight:780!important}.field input{min-height:48px!important;border-radius:13px!important;padding:0 14px!important;font-size:14.5px!important}.login-box .btn.full{min-height:50px!important;border-radius:13px!important;font-size:14.5px!important;font-weight:790!important;margin-top:4px!important;box-shadow:0 10px 24px rgba(160,84,51,.14)!important}.demo-note{margin-top:12px!important;padding:12px 13px!important;border-radius:12px!important;background:#fffaf6!important;border:1px solid #efddcf!important;color:#7b695c!important;font-size:10.5px!important;line-height:1.45!important}
      @media(max-width:1100px){.login{grid-template-columns:1fr!important}.login-hero{min-height:410px!important;padding:26px!important}.login-copy h1{font-size:36px!important}.login-panel{padding:28px 22px!important;border-left:0!important}.login-box{width:min(500px,100%)!important}}@media(max-width:680px){.login-logo{width:130px}.login-hero{min-height:340px!important}.login-copy h1{font-size:30px!important}.login-copy p{font-size:13.5px!important}.login-box{padding:22px 18px!important}.login-box h2{font-size:27px!important}}
    `;
    d.head.appendChild(s);
  }

  function content(d){
    const login=d.getElementById('loginScreen')||d.querySelector('.login');if(!login)return;
    login.setAttribute(FLAG,'1');
    const q=s=>d.querySelector(s);
    const brand=q('.login-brand');if(brand&&!brand.querySelector('.login-logo'))brand.innerHTML='<img class="login-logo" src="assets/pepama-logo.png" alt="Pepama Food Park">';
    if(q('.login-copy .ey'))q('.login-copy .ey').textContent='GESTÃO DO FOOD PARK';
    if(q('.login-copy h1'))q('.login-copy h1').textContent='Vendas, lojistas e contas do food park em um só lugar.';
    if(q('.login-copy p'))q('.login-copy p').textContent='Cada box vende pelo PDV. O sistema separa o que é do lojista e o que é do food park e deixa o mês pronto para o contador.';
    if(q('.login-box h2'))q('.login-box h2').textContent='Entrar';
    if(q('.login-box p'))q('.login-box p').textContent='Use seu e-mail e senha de acesso.';
    const enter=q('.login-box .btn.full');if(enter)enter.textContent='Entrar no sistema';
    const demo=q('.demo-note');if(demo)demo.innerHTML='<b>Primeiro acesso?</b> Depois de entrar, você configura o food park ou abre uma demonstração.';
    const foot=q('.login-foot');if(foot)foot.textContent='Tecnologia AYVO';
    q('.fp-strip')?.remove();q('.fp-scene')?.remove();
  }

  function reveal(){requestAnimationFrame(()=>requestAnimationFrame(()=>frame.classList.add('ayvo-ready')))}
  function apply(){const d=frame.contentDocument;if(!d||!d.head)return;install(d);content(d);reveal()}
  frame.addEventListener('load',()=>{setTimeout(apply,40);setTimeout(apply,180)});setTimeout(apply,60);setTimeout(apply,240);
})();