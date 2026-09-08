# 运行与重排

从 skill 根目录执行命令。输入必须是 UTF-8 Markdown；配置使用单独 YAML，不把正文开头的 `---` 猜成元数据。

```sh
node scripts/render.mjs article.md --out output/new-run --theme canglan
node scripts/render.mjs article.md --out output/new-run-2 --config settings.yml
```

可用主题：`zhusha` / `canglan` / `canglv` / `zheshi` / `tenghuang`。

```yaml
theme: zhusha
cover: true
author: ""
# 只有用户指定时添加，必须存在于原题：
coverHighlight: "AI 抛弃"
# 可选：用户指定的封面图，路径相对 Markdown
# coverImage: "images/cover.jpg"
# 可选：第 3 页笔触加粗 20%，上移 4px
# pageStyles:
#   "3":
#     markScale: 1.2
#     markLift: 4
```

CLI 的主题、关闭封面和封面高亮优先于 YAML。默认不添加作者或品牌标记。`--cover-image 用户图片路径` 可覆盖配置封面图，完整展示图片、不裁切。`pageStyles` 只调整指定页的笔触，不改变字体与分页；它的页码对应本次输出，修改原文分页后须重新核对。HTML 中的每个原文块有 `data-source="s…"`，`qa.json` 记录其分页片段数，可用来定位指定页的源内容。

## 素材

图片路径相对输入 Markdown；支持本地绝对路径、HTTP(S) URL 与 base64 图片 URL。远程链接只用于用户原文中的图片；失败时不代找替图。输出保存原图字节与 SHA256，渲染页面仅访问本地输出资源，不跟随图片中的外部引用。

`settings.yml` 自动保存 `assetMap`：原始图片地址到交付目录 `media/` 文件的映射。`source.md` 原样保留，不替换正文里相同的 URL。

重新排版已交付文件：

```sh
node scripts/render.mjs /delivery/source.md --config /delivery/settings.yml --out /delivery-next
```

素材映射相对配置文件目录；原文图片路径相对原文文件目录。输出目录必须不存在，避免误覆盖上一版。

## 分页与范围

段落、引用和超长列表项可跨页；有序列表继续原编号。代码块按可容纳的文字边界分段，拼接后与源代码文本逐字符相同。表格跨页重复表头；重复表头仅用于阅读，不计入原文完整性对比。标题尽量跟随至少两行正文。

表格单行超过整页时停止并提示拆分，不给出截断成品。公式和 Mermaid 不自动执行；Raw HTML 被转义为可见文字，避免输入改变页面脚本或样式。

PNG 为 1080×1440；它是红笺输出规格，不声称平台唯一支持的尺寸、张数或文件上限。

## 输出和验收

- `01.png …`：编号图片，已烧入纸纹和批注。
- `index.html`：响应式整组图片预览；可离线打开。
- `document.html`：真实文字 HTML，打开时重新绘制纸纹和批注；配套 `assets/` 不可删除。
- `source.md`：未经改写的输入。
- `settings.yml`：主题、作者、封面设置和素材映射。
- `media/`、`licenses/`：原图、字体许可。
- `manifest.json`：来源 hash、尺寸、主题与素材 hash。
- `qa.json`：逐块原文完整性、代码原样拼接、链接和图片保留、页面几何。

自动检查不判断内容事实或截图是否仍能看清；要查看真实图片。手机预览用约 390px 宽窗口，另外查看至少一张完整尺寸 PNG。跨页表头、列表编号、句子衔接与高亮每一行都要抽查。没有实际发布就不声称已发布。

## 长截图与安静纸面

独立段落中的长图优先沿较宽空白分段，并尽量让短标题跟随下文；没有段间空白时使用行间空白。找不到安全断点时，完整缩放保留原图并在 `qa.json` 中提示检查可读性，必要时改用用户提供的分段素材。每段使用同一张原图的连续窗口，`qa.json` 的 `imageSlices` 保存每段起点、高度与总高度；原图仍按哈希保留。短图按原比例居中。带大量附带文字的图片、嵌套列表中的长图应先安排成独立图片段落。

纸纹采用低对比、稀疏纤维；每页有稳定种子，同一页换主题时纹理不变，不同页避免相同纹样。纸面没有外部纹理、生成式图像或品牌水印。素材内原有标记会被保留，使用前需自行核对素材。
