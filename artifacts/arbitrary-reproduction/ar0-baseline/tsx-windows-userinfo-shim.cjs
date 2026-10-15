// Evidence-only workaround for Node 24 on this Windows host, where
// os.userInfo() fails with uv_os_get_passwd ENOMEM before tsx can start.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}
