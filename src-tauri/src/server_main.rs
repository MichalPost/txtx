/// 独立 HTTP 服务器入口（本地开发 / 生产部署用）
/// 运行: cargo run --bin txtx-server
fn main() {
    // 初始化结构化日志：RUST_LOG 环境变量控制级别，默认 info
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            if let Err(err) = txtx_app_lib::server::run_server().await {
                tracing::error!("txtx-server exited: {err:#}");
                std::process::exit(1);
            }
        });
}
