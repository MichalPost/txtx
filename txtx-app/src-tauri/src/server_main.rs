/// 独立 HTTP 服务器入口（本地开发 / 生产部署用）
/// 运行: cargo run --bin txtx-server
fn main() {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(txtx_app_lib::server::run_server());
}
