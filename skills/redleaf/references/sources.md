# 来源与实现范围

- Kami by tw93：https://kami.tw93.fun/index-zh.html ，https://github.com/tw93/kami 。2026-09-08 阅读产品主页、设计原则与本地设计规范。借鉴统一设计语言、有限变量、层级和生产检查的思路。红笺的 tokens、CSS、纸纹、笔触、样张与说明为独立编写，没有复制 Kami 模板或脚本。
- 中国色：https://zhongguose.com/ ，https://zhongguose.com/colors.json 。2026-09-08 取五个色名及对应 HEX 作为数字色彩参考；没有复制整套数据库或网站实现。
- 东方色：https://www.2kil.com/ 。朱砂沿用该站「硃砂」#B84B48，来自已确认的视觉探索。
- 思源宋体：https://github.com/adobe-fonts/source-han-serif ，固定源提交 7889f11bf31170b5d092a083b357c8c8130f89e0，Medium SC。
- 思源黑体：https://github.com/adobe-fonts/source-han-sans ，固定源提交 a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2，Regular / Bold SC。
- 字体按 SIL Open Font License 1.1 分发，许可证位于 `licenses/`。没有修改或重命名字体内部名称；CSS 家族别名只用于页面引用。
- Rough Notation 仅在早期研究中作为笔触参考；本版不引入其代码或依赖。

若未来实际复用任何第三方代码，应逐项记录文件和范围并保留适用许可，不能以“灵感”代替真实的代码来源披露。

- Noto Sans Mono：https://github.com/google/fonts/tree/main/ofl/notosansmono ，固定提交 097bc1b8c04c3224087c2ae95f7a923859b778cf，SIL OFL 1.1；用于代码拉丁字符。
