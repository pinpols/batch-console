import io.github.pinpols.batch.console.domain.rbac.support.ConsolePasswordHasher;

/** 从被验收运行包调用正式密码实现，原密码只经临时子进程环境传入。 */
class PasswordHash {
  public static void main(String[] args) {
    System.out.println(new ConsolePasswordHasher().encode(System.getenv("E2E_PROGRESS_PASSWORD")));
  }
}
