# SQLite on Vercel の制限

## 概要
SQLite ファイルは Vercel Serverless のインスタンス間でファイルシステムを共有しないため、複数インスタンスにスケールした際にデータ不整合が発生する。

## 対策
- セルフホスト（Railway, Fly.io, VPS）での運用を推奨
- Vercel にデプロイする場合は Turso または Supabase へのマイグレーションが必要

## 優先度
Medium（セルフホストで運用する限り問題なし）
