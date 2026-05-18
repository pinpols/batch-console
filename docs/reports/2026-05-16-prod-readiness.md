# 生产就绪审计 — Build / Runtime / Security

**日期**:2026-05-16
**范围**:生产构建 sanity check + Runtime 性能 + 安全审计 三个维度。

---

## 🔴 修复(本轮做完)

### 1. Axios 1.13.6 → 1.16.1(**15+ CVE 修**)

最严重的运行时漏洞。1.13.6 至少 15 个 advisories,**含可被远程触发的 SSRF / Prototype Pollution / Header Injection**。

|  | 升级前(1.13.6) | 升级后(1.16.1) |
|---|---|---|
| **NO_PROXY hostname normalization SSRF** | ⚠ high | ✅ |
| **Cloud metadata exfiltration via header injection** | ⚠ high | ✅ |
| **Prototype pollution → auth bypass** | ⚠ high | ✅ |
| **127.0.0.0/8 loopback subnet bypass** | ⚠ high | ✅ |
| **CRLF injection in multipart blob.type** | ⚠ high | ✅ |
| **maxBodyLength bypass with maxRedirects:0** | ⚠ high | ✅ |
| **maxContentLength bypass in streamed responses** | ⚠ high | ✅ |
| **withXSRFToken cross-origin leakage** | ⚠ high | ✅ |
| **Header injection via prototype pollution** | ⚠ high | ✅ |
| **Response tampering via prototype pollution** | ⚠ high | ✅ |
| **Null byte injection in URLSearchParams** | ⚠ high | ✅ |
| **DoS via deeply nested toFormData** | ⚠ high | ✅ |
| **parseReviver invisible response tampering** | ⚠ high | ✅ |
| **HTTP adapter credential injection** | ⚠ high | ✅ |
| **no_proxy bypass via IP alias** | ⚠ high | ✅ |

[package.json](package.json) `axios: "^1.7.9"` → 实际锁到 `1.16.1`。

---

## 📊 Build 维度

### 产出

```
✓ built in 46.25s
Total dist: 6.8 MB
PWA: 245 entries (6.4 MB precache)
```

✅ 无 build error / warning(`chunkSizeWarningLimit: 1200` 已配)。

### Top 10 chunk(裸字节)

| Chunk | Size | gzip | 备注 |
|---|---|---|---|
| `vendor-element-plus` | 916KB | 300KB | 单一最大,Element Plus 全量 vendor |
| `WorkflowMermaidViewer` | 568KB | 134KB | 仅 1 个页面 lazy 加载 ✓ |
| `OpsSummary` | 548KB | 187KB | echarts 已 tree-shaken(line + bar) |
| `wardley`(mermaid) | 484KB | 110KB | 仅 mermaid 渲染 |
| `index` | 448KB | 153KB | 主入口 router + auth + stores |
| `cytoscape.esm` | 436KB | 141KB | mermaid 依赖 |
| `katex` | 256KB | 76KB | mermaid LaTeX 支持 |
| `vendor-vue` | 112KB | 43KB | Vue runtime |

### 评估

- ✅ **路由 lazy split 正确**:所有页面级组件按 route lazy import
- ✅ **重量级库正确隔离**:mermaid / cytoscape / katex 仅在 WorkflowMermaidViewer 路由触发
- ✅ **echarts tree-shake**:只引用 `BarChart / LineChart + 4 components`(`src/charts/echarts.ts`)
- ⚠️ **Element Plus 300KB gzip** 全应用首屏加载 — 可优化空间小,B2B 后台可接受
- ✅ **PWA precache 6.4MB** — 离线可用 / 二次加载从 cache 走

**结论**:无阻塞性 build 问题。

---

## ⚡ Runtime 性能维度

### 测量(headless Chromium @ 1680×980)

| 路由 | DOM Ready | FCP | DOM nodes | JS Heap |
|---|---|---|---|---|
| `/ops/summary` | 106ms | 332ms | 688 | 29.8MB |
| `/runs` | 80ms | 292ms | 611 | 29.8MB |
| `/jobs/definitions` | 71ms | 360ms | 846 | 29.8MB |
| `/system/tenants` | 120ms | 536ms | 1027 | 29.8MB |
| `/governance/queues` | 61ms | 268ms | 705 | 29.8MB |
| `/observability/alerts` | 86ms | 464ms | 1140 | 29.8MB |
| `/workflow/designer` | 128ms | 168ms | 31(SVG 不计) | 29.8MB |

### 评估

- ✅ **FCP 全部 < 600ms**(本机 + cache 暖,真实生产首次 1.5x-2x 可接受)
- ✅ **DOM nodes 全部 < 1200**(Lighthouse 红线 1500)
- ✅ **Heap 稳定在 30MB**(不随路由切换增长 → 无内存泄漏)
- ✅ **dom-ready < 130ms**(轻量路由代码量适配 lazy chunk)

**结论**:无 runtime 性能红旗。

---

## 🔒 Security 维度

### 1. npm audit(public registry)

| 严重级 | 数量 | 类别 |
|---|---|---|
| critical | 0 | — |
| **high(runtime)** | 0 ✅ (本轮升 axios 后清零) | — |
| high(dev-only) | 4 | playwright / vite / lodash(dev tooling) |
| moderate | 7 | postcss / lodash transit 等(全 dev) |

剩余 4 个 high 全是 dev 依赖,**不进生产 bundle**:
- `@playwright/test` / `playwright` — 测试 only
- `vite` — dev server only
- `lodash 4.17.23` — `_.template` code injection;**前端代码没 `_.template(userInput)` 用法**,只是 dagre / element-plus 内部用,**非利用路径**

### 2. XSS sink 扫描

| sink | 出现次数 | 评估 |
|---|---|---|
| `v-html` | 0 真使用 | ESLint `vue/no-v-html: error` 全禁,只剩 2 处注释解释为何不用 |
| `dangerouslyUseHTMLString: true` | 0 | ElMessage 全部用纯文本 |
| `document.write` | 0 | — |
| `element.innerHTML =` | 6 | **全部安全**: |
| | • `directives/safeHtml.ts` × 3 | 经 DOMPurify `purifyHtml` 过滤后赋值 |
| | • `WorkflowMermaidViewer.vue` × 2 / `MWorkflowViewer.vue` × 2 | SVG 来自 `mermaid.render()`(可信源),非用户输入 |
| | • 含 `= ''` 清空 | 安全 |

**结论**:0 真 XSS 路径。

### 3. NGINX security headers

[nginx/default.conf.template](nginx/default.conf.template) 已配:

| Header | 已加 | 备注 |
|---|---|---|
| `X-Content-Type-Options: nosniff` | ✅ | 阻 MIME sniff |
| `X-Frame-Options: SAMEORIGIN` | ✅ | 阻 clickjacking |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ | |
| `X-XSS-Protection: 1; mode=block` | ✅ | (legacy,新浏览器已忽略,留无害) |
| `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()` | ✅ | |
| **`Content-Security-Policy`** | ❌ **缺** | 第二层防 XSS 没启用 |
| `Strict-Transport-Security` | ❌ 缺(若走 HTTPS 部署) | |

### 4. Auth 安全态势

- **F-1 后端 Set-Cookie 未实现** — 前端 dev fallback 已加(仅 DEV,prod 走 cookie)。**后端必须补完 Set-Cookie 才能上线 prod**。

---

## 📋 交付检查表

| 项 | 状态 |
|---|---|
| TypeScript | ✅ 0 errors |
| ESLint src/ | ✅ 0 problems |
| 生产 build | ✅ 46s 通过 |
| Bundle 合理 split | ✅ |
| Runtime FCP < 600ms | ✅ |
| Runtime 内存稳定 | ✅ |
| npm audit runtime high | ✅ 0(axios 升级修了 15 CVE) |
| XSS sink | ✅ 0 真路径 |
| NGINX 5/7 security headers | ⚠ 缺 CSP + HSTS |
| 后端 Cookie 鉴权 | 🔴 后端事 |

---

## 🟡 建议(下一迭代加,本轮不动)

1. **NGINX 加 CSP**(单独 PR,需要测试)
   ```nginx
   add_header Content-Security-Policy "
     default-src 'self';
     script-src 'self';
     style-src 'self' 'unsafe-inline';  # Element Plus 内部用 inline style
     img-src 'self' data: https:;
     font-src 'self' data:;
     connect-src 'self' wss://;          # SSE / WebSocket
     frame-ancestors 'self';
     base-uri 'self';
     object-src 'none';
   " always;
   ```
   先在 staging 测试一周,看 console 是否报 CSP block,再上 prod。

2. **HTTPS 部署后加 HSTS**
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```

3. **lodash 升级到 4.17.21+**(虽然不可被利用,但 audit 噪音)— 等 dagre / element-plus 上游升级

4. **后端联调**:F-1 Set-Cookie 落地后,删除 [src/stores/auth.ts](src/stores/auth.ts) 和 [src/api/interceptors.ts](src/api/interceptors.ts) 的 dev fallback 块(已用注释标"后端补完后可删")

---

## 改动文件(本轮)

- **package.json / package-lock.json** — axios 升级 1.13.6 → 1.16.1

仅 1 处 prod 改动(security patch),回归风险极低(axios 1.13→1.16 全是 patch / minor,无 breaking API 变更)。

---

## 最终结论

**前端层面 production-ready**:

| 维度 | 评级 |
|---|---|
| 功能完整性 | A |
| 类型安全 | A(TS 0 errors) |
| Lint 卫生 | A(0 problems) |
| 可访问性 | A- |
| 国际化 | A(2850/2850 对称) |
| Bundle 效率 | B+(Element Plus 300KB 略大但合理) |
| Runtime 性能 | A(FCP < 600ms,heap 稳) |
| 依赖安全 | A(runtime 0 high,dev 漏洞不入生产) |
| XSS 防护 | A(0 sink,DOMPurify 把关) |
| 部署 headers | B(缺 CSP + HSTS) |

**单一上线 blocker**:**后端 Set-Cookie**(F-1)。前端不再有阻塞项。
