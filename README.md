# CET-6 高频词汇通关手册

892 个六级核心词 + 81 条高频短语，纯静态、零依赖、离线可用的单词闯关站。

**在线地址**：https://shangmaster.github.io/cet6-vocab/

## 每个词都有什么

| 内容 | 说明 |
|---|---|
| 美式音标 / 英式音标 | 双音标并排显示（如 `/əˈbændən/` 美 · `/əˈbɒlɪʃ/` 英） |
| 美音 / 英音发音 | 每个音标旁一个独立播放按钮，真人语音 |
| 词性 + 释义 | `vt.` / `adj.` / `n.` … |
| 词根词缀拆解 | 构词拆分 + 词根义 + 语义联想 |
| 派生词族 | 同词族的形容词 / 副词 / 名词，带词性和中文释义，点词可发音 |
| 动词变化 | 过去式、过去分词、现在分词 |
| 例句 + 译文 | 一句英文 + 一句中文 |

## 功能

- **词汇表**：中英文/音标/派生词全文检索、按字母索引、未掌握 / 已掌握 / 收藏 / 有派生词筛选、A-Z / Z-A / 按词长排序
- **闪卡**：翻面记忆，空格翻面、← → 切换、M 已掌握、X 不认识、1 美音、2 英音
- **测验**：英→中 / 中→英 四选一，可选题量，自动混入 40% 错词强化
- **错词本**：答错和"不认识"自动收录，可一键用错词出题
- **高频短语**：按场景分组的 81 条搭配
- **深色模式**、学习进度存 localStorage

## 数据规模

- 892 词 / 81 短语
- 892 词全部有美式 + 英式音标
- 570 个词带派生词族，共 798 条派生词（按 CET4/6/考研/托福/雅思 常用度筛选，剔除 GRE 冷僻词）

## 部署

```bash
# 单文件版：一个 HTML 拷给别人就能用
dist/index.html

# 多文件版：直接扔到任意静态托管（GitHub Pages / Netlify / Vercel / Cloudflare Pages）
site/
```

## 本地开发

```bash
node tools/extract-words.js      # 从 data-*.js 抽出词表
python tools/fetch_phonetics.py  # 抓英美音标
python tools/build_derivs.py     # 生成派生词数据
node tools/build-single.js       # 打单文件版 dist/index.html
node tools/build-site.js         # 打发布目录 site/
node tools/verify.js  <url>      # 无头浏览器验收
node tools/verify-views.js       # 分视图验收
```

音标与发音数据来源：有道词典。词根词缀与例句为手工整理。
