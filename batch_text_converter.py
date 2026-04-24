#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
批量文本转换工具
支持将指定目录下的文本文件批量转换为简体中文
"""

import asyncio
import logging
import sys
from pathlib import Path
from typing import List, Optional, Tuple
import argparse
import shutil

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table

from text_converter import TextConverter

console = Console()

class BatchTextConverter:
    """批量文本转换器"""
    
    def __init__(self):
        """初始化批量转换器"""
        self.converter = TextConverter()
        self.supported_extensions = {'.txt', '.md', '.text'}
    
    def _read_file_with_encoding(self, file_path: Path, encoding: str) -> str:
        """同步读取文件（用于线程池）"""
        with open(file_path, 'r', encoding=encoding) as f:
            return f.read()
    
    def _write_file(self, file_path: Path, content: str) -> None:
        """同步写入文件（用于线程池）"""
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
    def find_text_files(self, directory: Path, recursive: bool = True) -> List[Path]:
        """查找目录中的文本文件
        
        Args:
            directory: 目标目录
            recursive: 是否递归搜索子目录
            
        Returns:
            文本文件路径列表
        """
        files = []
        
        if recursive:
            for ext in self.supported_extensions:
                files.extend(directory.rglob(f'*{ext}'))
        else:
            for ext in self.supported_extensions:
                files.extend(directory.glob(f'*{ext}'))
        
        return sorted(files)
    
    async def convert_file(self, file_path: Path, source_dir: Path, output_dir: Optional[Path] = None,
                          backup: bool = True, force: bool = False, convert_filename: bool = True) -> Tuple[bool, str, bool]:
        """转换单个文件
        
        Args:
            file_path: 文件路径
            source_dir: 源目录路径（用于计算相对路径）
            output_dir: 输出目录（如果为None则覆盖原文件）
            backup: 是否创建备份（仅在覆盖模式下有效）
            force: 是否强制转换（不检测是否包含繁体）
            convert_filename: 是否转换文件名
            
        Returns:
            tuple: (是否成功, 状态信息, 是否进行了转换)
        """
        try:
            # 读取文件内容 (使用异步)
            try:
                content = await asyncio.to_thread(self._read_file_with_encoding, file_path, 'utf-8')
            except UnicodeDecodeError:
                # 尝试其他编码
                encodings = ['gbk', 'gb2312', 'big5']
                content = None
                for encoding in encodings:
                    try:
                        content = await asyncio.to_thread(self._read_file_with_encoding, file_path, encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                
                if content is None:
                    return False, "无法识别文件编码", False
            
            if not content.strip():
                return True, "文件为空，跳过", False
            
            # 转换文本
            if force:
                converted_content = self.converter.convert_traditional_to_simplified(content)
                has_converted = converted_content != content
            else:
                converted_content, has_converted = self.converter.detect_and_convert_text(content)
            
            if not has_converted:
                return True, "无需转换", False
            
            # 确定输出路径
            if output_dir:
                # 输出到指定目录，保持相对路径结构
                relative_path = file_path.relative_to(source_dir)
                
                # 转换文件名（如果需要）
                if convert_filename:
                    # 转换文件名中的繁体字
                    original_name = relative_path.stem
                    original_suffix = relative_path.suffix
                    converted_name = self.converter.convert_traditional_to_simplified(original_name)
                    
                    if converted_name != original_name:
                        # 文件名有变化，使用转换后的文件名
                        new_relative_path = relative_path.parent / (converted_name + original_suffix)
                        output_path = output_dir / new_relative_path
                    else:
                        output_path = output_dir / relative_path
                else:
                    output_path = output_dir / relative_path
                    
                output_path.parent.mkdir(parents=True, exist_ok=True)
                # 写入转换后的内容到输出目录
                await asyncio.to_thread(self._write_file, output_path, converted_content)
            else:
                # 覆盖原文件模式
                if convert_filename:
                    # 转换文件名
                    original_name = file_path.stem
                    original_suffix = file_path.suffix
                    converted_name = self.converter.convert_traditional_to_simplified(original_name)
                    
                    if converted_name != original_name:
                        # 文件名需要转换
                        new_file_path = file_path.parent / (converted_name + original_suffix)
                        
                        # 创建备份
                        if backup:
                            backup_path = file_path.with_suffix(file_path.suffix + '.bak')
                            await asyncio.to_thread(shutil.copy2, file_path, backup_path)
                        
                        # 写入转换后的内容到新文件名
                        await asyncio.to_thread(self._write_file, new_file_path, converted_content)
                        
                        # 删除原文件（如果文件名改变了）
                        if new_file_path != file_path:
                            await asyncio.to_thread(file_path.unlink)
                        
                        output_path = new_file_path
                    else:
                        # 文件名不需要转换，正常处理
                        output_path = file_path
                        if backup:
                            backup_path = file_path.with_suffix(file_path.suffix + '.bak')
                            await asyncio.to_thread(shutil.copy2, file_path, backup_path)
                        await asyncio.to_thread(self._write_file, output_path, converted_content)
                else:
                    # 不转换文件名
                    output_path = file_path
                    if backup:
                        backup_path = file_path.with_suffix(file_path.suffix + '.bak')
                        await asyncio.to_thread(shutil.copy2, file_path, backup_path)
                    await asyncio.to_thread(self._write_file, output_path, converted_content)
            
            if output_dir:
                return True, f"转换成功 -> {output_path.relative_to(output_dir)}", True
            else:
                return True, "转换成功", True
            
        except Exception as e:
            return False, f"转换失败: {str(e)}", False
    
    async def convert_directory(self, directory: Path, output_dir: Optional[Path] = None,
                               recursive: bool = True, backup: bool = True, force: bool = False,
                               dry_run: bool = False, convert_filename: bool = True) -> None:
        """转换目录中的所有文本文件
        
        Args:
            directory: 目标目录
            output_dir: 输出目录（如果为None则覆盖原文件）
            recursive: 是否递归处理子目录
            backup: 是否创建备份文件（仅在覆盖模式下有效）
            force: 是否强制转换所有文件
            dry_run: 是否只是预览，不实际转换
            convert_filename: 是否转换文件名
        """
        if not self.converter.is_available():
            console.print("[red]❌ 繁简转换器不可用，请安装 opencc-python-reimplemented[/red]")
            return
        
        if not directory.exists():
            console.print(f"[red]❌ 目录不存在: {directory}[/red]")
            return
        
        if not directory.is_dir():
            console.print(f"[red]❌ 路径不是目录: {directory}[/red]")
            return
        
        # 查找文件
        console.print(f"[blue]🔍 正在搜索文本文件...[/blue]")
        text_files = self.find_text_files(directory, recursive)
        
        if not text_files:
            console.print("[yellow]📝 未找到支持的文本文件[/yellow]")
            console.print(f"[dim]支持的文件类型: {', '.join(self.supported_extensions)}[/dim]")
            return
        
        console.print(f"[green]📚 找到 {len(text_files)} 个文本文件[/green]")
        
        # 预览模式
        if dry_run:
            console.print("[yellow]🔍 预览模式 - 检测哪些文件需要转换:[/yellow]")
            
            preview_table = Table(title="文件转换预览")
            preview_table.add_column("文件路径", style="cyan")
            preview_table.add_column("状态", style="green")
            preview_table.add_column("需要转换", style="yellow")
            
            need_conversion = 0
            for file_path in text_files:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if content.strip():
                        _, has_traditional = self.converter.detect_and_convert_text(content)
                        if has_traditional:
                            preview_table.add_row(
                                str(file_path.relative_to(directory)), 
                                "包含繁体", 
                                "✅"
                            )
                            need_conversion += 1
                        else:
                            preview_table.add_row(
                                str(file_path.relative_to(directory)), 
                                "已是简体", 
                                "❌"
                            )
                    else:
                        preview_table.add_row(
                            str(file_path.relative_to(directory)), 
                            "文件为空", 
                            "❌"
                        )
                except Exception as e:
                    preview_table.add_row(
                        str(file_path.relative_to(directory)), 
                        f"读取失败: {str(e)[:30]}", 
                        "❓"
                    )
            
            console.print(preview_table)
            console.print(f"[green]📊 共 {need_conversion} 个文件需要转换[/green]")
            return
        
        # 创建输出目录
        if output_dir:
            output_dir.mkdir(parents=True, exist_ok=True)
            console.print(f"[blue]📁 输出目录: {output_dir}[/blue]")
        
        # 执行转换
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console,
            transient=False
        ) as progress:
            
            task_id = progress.add_task(
                "[cyan]正在转换文件...[/cyan]", 
                total=len(text_files)
            )
            
            success_count = 0
            converted_count = 0
            failed_files = []
            
            for file_path in text_files:
                try:
                    success, message, has_converted = await self.convert_file(
                        file_path, directory, output_dir, backup, force, convert_filename
                    )
                    
                    if success:
                        success_count += 1
                        if has_converted:
                            converted_count += 1
                    else:
                        failed_files.append((file_path, message))
                    
                    progress.update(task_id, advance=1)
                    
                except Exception as e:
                    failed_files.append((file_path, str(e)))
                    progress.update(task_id, advance=1)
        
        # 显示结果
        console.print(f"\n[green]✅ 转换完成![/green]")
        console.print(f"[blue]📊 处理统计:[/blue]")
        console.print(f"  • 总文件数: {len(text_files)}")
        console.print(f"  • 成功处理: {success_count}")
        console.print(f"  • 实际转换: {converted_count}")
        console.print(f"  • 失败文件: {len(failed_files)}")
        
        if output_dir and converted_count > 0:
            console.print(f"[dim]📁 转换后的文件已保存到: {output_dir}[/dim]")
        elif backup and converted_count > 0 and not output_dir:
            console.print(f"[dim]💾 备份文件已创建（.bak 后缀）[/dim]")
        
        if failed_files:
            console.print(f"\n[red]❌ 失败的文件:[/red]")
            for file_path, error in failed_files:
                console.print(f"  • {file_path}: {error}")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="批量将文本文件转换为简体中文",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python batch_text_converter.py /path/to/novels                    # 覆盖原文件
  python batch_text_converter.py /path/to/novels -o /path/to/output # 输出到指定目录
  python batch_text_converter.py /path/to/novels --no-recursive     # 只转换当前目录
  python batch_text_converter.py /path/to/novels --no-backup        # 不创建备份
  python batch_text_converter.py /path/to/novels --dry-run          # 预览模式
  python batch_text_converter.py /path/to/novels --force            # 强制转换所有文件
        """
    )
    
    parser.add_argument(
        'directory',
        type=str,
        help='要转换的目录路径'
    )
    
    parser.add_argument(
        '-o', '--output',
        type=str,
        help='输出目录路径（如果不指定则覆盖原文件）'
    )
    
    parser.add_argument(
        '--no-recursive',
        action='store_true',
        help='不递归处理子目录'
    )
    
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='不创建备份文件'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='强制转换所有文件（不检测是否包含繁体）'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='预览模式，只检测不实际转换'
    )
    
    parser.add_argument(
        '--no-filename-convert',
        action='store_true',
        help='不转换文件名中的繁体字'
    )
    
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='日志级别'
    )
    
    args = parser.parse_args()
    
    # 设置日志
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # 创建转换器
    converter = BatchTextConverter()
    
    # 执行转换
    directory = Path(args.directory).resolve()
    output_dir = Path(args.output).resolve() if args.output else None
    
    try:
        asyncio.run(converter.convert_directory(
            directory=directory,
            output_dir=output_dir,
            recursive=not args.no_recursive,
            backup=not args.no_backup,
            force=args.force,
            dry_run=args.dry_run,
            convert_filename=not args.no_filename_convert
        ))
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️ 用户中断操作[/yellow]")
    except Exception as e:
        console.print(f"[red]💥 程序执行失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()