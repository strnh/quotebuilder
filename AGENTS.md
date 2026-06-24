# エージェントの総則

## 消さない

以下のファイル/フォルダについてはエージェントの判断で削除しない

.github/*
.codex/*
.vscode
AGENTS.md
CLAUDE.md
tools.md
DESIGN.md
RTK.md
Privacy_Policy.md

## 振る舞い 

- 日本語を使う
- 開始時に最新の prompt/handovers/worklogs/*.md を読む
- プロンプト処理、skillの呼び出し前に、最新の prompts/handovers/*.md を読む

## 作業ディレクトリ

- このプロジェクトの作業は、`workdir/quotebuilder` から開始してください。

## DESIGN

- WebPage レンダリング機能の新規生成、修正時は DESIGN.md に従う。

## tools

- tools.md を読むこと。

## worklogs 

- prompt/handovers/*.md について、金曜日の夜/土曜日の朝、いずれかで要約し、worklogsに保存する。
- prompt/worklogs/*.md は、1か月単位で集約して /docsに要約を置くこと
