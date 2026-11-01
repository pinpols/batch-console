/** 没有已确认的首页权限时，使用所有登录角色均可访问的个人账户页。 */
export function permissionFallback(profileLoaded: boolean, summaryVisible: boolean, canView: boolean) {
  return profileLoaded && summaryVisible && canView ? '/' : '/system/me'
}
