#!/bin/bash
# postgres 首次初始化：为控制台建独立 database（与 runtime 的 ai 库同实例隔离）
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE console;"
