/** 通知链接不得选择或更改用户当前使用的租户。 */
export function notificationTenantMatches(queryTenant: unknown, activeTenant: string) {
  return !!activeTenant && (queryTenant === undefined ||
    (typeof queryTenant === 'string' && queryTenant === activeTenant))
}
