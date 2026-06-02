# 前端可配置功能实现计划

> **目标:** 将广告过滤规则、导航关键词、TTKS 域名、延迟参数、XPath 多规则 fallback、User-Agent 池等硬编码项全部提升到配置文件，并在前端页面提供编辑界面。

## 总览

| Task | 内容 | 文件 |
|------|------|------|
| 1 | 扩展 models.rs 添加 ContentFilterConfig + SiteSpecialMode | models.rs |
| 2 | crawler.rs 读取 content_filter 配置替换硬编码 | crawler.rs |
| 3 | ttks_downloader.rs 读取配置替换硬编码 | ttks_downloader.rs, models.rs |
| 4 | crawler.rs 支持 XPath 多规则 fallback | crawler.rs |
| 5 | 更新 config.yml 加入新配置节 | config/config.yml |
| 6 | 更新前端类型 types/index.ts | types/index.ts |
| 7 | SettingsPage 添加内容过滤、UA池、高级参数卡片 | SettingsPage.tsx |
| 8 | WebsitesPage 添加 special_mode 下拉 + XPath fallback 说明 | WebsitesPage.tsx |
| 9 | BlacklistPage 添加 tag_filter 及 filtered_tags 编辑 | BlacklistPage.tsx |
