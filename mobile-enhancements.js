(function(){
  const loadOrangeWhiteTheme=()=>{
    if(document.querySelector('script[data-ayvo-orange-white]'))return;
    const visual=document.createElement('script');
    visual.src='orange-white-theme.js?v=20261029a';
    visual.dataset.ayvoOrangeWhite='1';
    document.head.appendChild(visual);
  };

  const loadParkOperations=()=>{
    if(document.querySelector('script[data-ayvo-park-ops]')){loadOrangeWhiteTheme();return;}
    const ops=document.createElement('script');
    ops.src='park-operations.js?v=20261029a';
    ops.dataset.ayvoParkOps='1';
    ops.onload=loadOrangeWhiteTheme;
    ops.onerror=loadOrangeWhiteTheme;
    document.head.appendChild(ops);
  };

  const loadCommercialSuite=()=>{
    const theme=document.createElement('script');
    theme.src='commercial-theme.js?v=20261029a';
    theme.onload=()=>{
      const polish=document.createElement('script');
      polish.src='commercial-polish.js?v=20261029a';
      polish.onload=loadParkOperations;
      polish.onerror=loadParkOperations;
      document.head.appendChild(polish);
    };
    theme.onerror=()=>{
      const polish=document.createElement('script');
      polish.src='commercial-polish.js?v=20261029a';
      polish.onload=loadParkOperations;
      polish.onerror=loadParkOperations;
      document.head.appendChild(polish);
    };
    document.head.appendChild(theme);
  };

  const core=document.createElement('script');
  core.src='mobile-enhancements-core.js?v=20261029a';
  core.onload=()=>{
    const fix=document.createElement('script');
    fix.src='nav-hotfix.js?v=20261029a';
    fix.onload=loadCommercialSuite;
    fix.onerror=loadCommercialSuite;
    document.head.appendChild(fix);
  };
  core.onerror=loadCommercialSuite;
  document.head.appendChild(core);

  const ledger=document.createElement('script');
  ledger.src='foodpark-ledger.js?v=20261029a';
  ledger.onload=()=>{
    const foodpark=document.createElement('script');
    foodpark.src='foodpark.js?v=20261029a';
    document.head.appendChild(foodpark);
  };
  document.head.appendChild(ledger);
})();