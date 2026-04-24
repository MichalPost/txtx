#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import sys
from datetime import datetime
from date_manager import DateManager

def main():
    """日期管理工具命令行接口"""
    parser = argparse.ArgumentParser(description='小说下载器日期管理工具')
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 显示状态命令
    status_parser = subparsers.add_parser('status', help='显示当前日期状态')
    
    # 设置日期命令
    set_parser = subparsers.add_parser('set', help='设置上次下载日期')
    set_parser.add_argument('date', help='日期，格式：YYYY-MM-DD')
    
    # 重置日期命令
    reset_parser = subparsers.add_parser('reset', help='重置下载日期（下次运行将使用完整天数限制）')
    
    # 预览命令
    preview_parser = subparsers.add_parser('preview', help='预览下次运行将使用的日期范围')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        dm = DateManager()
        
        if args.command == 'status':
            show_status(dm)
        elif args.command == 'set':
            set_date(dm, args.date)
        elif args.command == 'reset':
            reset_date(dm)
        elif args.command == 'preview':
            preview_range(dm)
            
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)

def show_status(dm: DateManager):
    """显示当前状态"""
    print("=== 日期状态 ===")
    
    last_date = dm.get_last_download_date()
    if last_date is None:
        print("上次下载日期: 未设置（首次运行）")
    else:
        days_since = dm.get_days_since_last_download()
        print(f"上次下载日期: {last_date}")
        print(f"距今天数: {days_since} 天")
    
    target_date, actual_days = dm.get_download_date_range()
    print(f"下次运行目标日期: {target_date}")
    print(f"下次运行天数范围: {actual_days} 天")

def set_date(dm: DateManager, date_str: str):
    """设置日期"""
    try:
        # 验证日期格式
        datetime.strptime(date_str, '%Y-%m-%d')
        dm.update_last_download_date(date_str)
        print(f"✅ 已设置上次下载日期为: {date_str}")
        
        # 显示影响
        target_date, actual_days = dm.get_download_date_range()
        print(f"📅 下次运行将下载 {actual_days} 天内的小说（目标日期: {target_date}）")
        
    except ValueError:
        print("❌ 日期格式错误，请使用 YYYY-MM-DD 格式")
        sys.exit(1)

def reset_date(dm: DateManager):
    """重置日期"""
    dm.reset_download_date()
    print("✅ 已重置下载日期记录")
    
    target_date, actual_days = dm.get_download_date_range()
    print(f"📅 下次运行将下载 {actual_days} 天内的小说（目标日期: {target_date}）")

def preview_range(dm: DateManager):
    """预览日期范围"""
    print("=== 下次运行预览 ===")
    
    last_date = dm.get_last_download_date()
    target_date, actual_days = dm.get_download_date_range()
    
    if last_date is None:
        print("状态: 首次运行")
    else:
        days_since = dm.get_days_since_last_download()
        print(f"上次下载: {last_date} ({days_since} 天前)")
    
    print(f"目标日期: {target_date}")
    print(f"天数范围: {actual_days} 天")
    print(f"将下载 {target_date} 之后发布的小说")

if __name__ == '__main__':
    main()