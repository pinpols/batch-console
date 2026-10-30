async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('batch-console-session', '1');
    localStorage.setItem('batch-console-tenant-id', 'ta');
    localStorage.setItem('batch-console:locale', 'zh-CN');
    localStorage.setItem('batch-console-onboarding-done:2026-10-v2:' + encodeURIComponent('journey-admin:ta'), '1');
  });
  let abandoned = false;
  let attempts = 0;
  await page.route('**/api/console/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let data = {items: [], total: 0, pageNo: 1, pageSize: 20};
    let status = 200;
    if (path === '/api/console/auth/me') data = {username:'journey-admin',tenantId:'ta',authorities:['ROLE_ADMIN']};
    else if (path === '/api/console/tenants') data = {items:[{tenantId:'ta',tenantName:'Tenant A',status:'ACTIVE'}],total:1};
    else if (path === '/api/console/queries/batch-days/2026-10-15/window') data = {tenantId:'ta',bizDate:'2026-10-15',calendarCode:'CALENDAR', jobs:[], scheduledOccurrences:[]};
    else if (path === '/api/console/jobs/batch-days/2026-10-15/catchup') {status = 404; data = null;}
    else if (path === '/api/console/jobs/batch-days/catchup/requests/status') data = abandoned ? {found:true,tenantId:'ta',bizDate:'2026-10-15',calendarCode:'CALENDAR',operationStatus:'ABANDONED',items:[]} : {found:false,tenantId:'ta',items:[]};
    else if (path === '/api/console/jobs/batch-days/catchup/requests/abandon') { attempts++; if (attempts === 1) {status=503; data=null;} else {abandoned=true; data={found:true,tenantId:'ta',bizDate:'2026-10-15',calendarCode:'CALENDAR',operationStatus:'ABANDONED',items:[]};} }
    if (path.includes('/catchup')) await page.evaluate(entry => {window.__fenceLog = [...(window.__fenceLog || []), entry]}, {path, status, headers:req.headers(), body:req.postData()});
    await route.fulfill({status, json:{code:status===200?'SUCCESS':'TEST_REJECTION',message:status===200?'ok':'mock rejection',data}});
  });
  await page.goto('http://127.0.0.1:5179/scheduler/batch-days/2026-10-15?calendarCode=CALENDAR');
}
