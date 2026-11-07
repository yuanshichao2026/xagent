import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface ProcessedAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  ext: string;
  savedPath: string;
  dataUrl?: string;
  extractedText?: string;
}

export async function processUploadedFile(
  workspacePath: string,
  file: { name: string; type: string; base64: string }
): Promise<ProcessedAttachment> {
  const uploadDir = path.join(workspacePath, '.codex', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // 去除 base64 前缀如 "data:image/png;base64,"
  const base64Data = file.base64.replace(/^data:.*?;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const size = buffer.length;

  const ext = path.extname(file.name).toLowerCase();
  const safeBaseName = path.basename(file.name, ext).replace(/[^\w\u4e00-\u9fa5-_.]/g, '_');
  const uniqueFileName = `${Date.now()}_${safeBaseName}${ext}`;
  const savedPath = path.join(uploadDir, uniqueFileName);

  // 保存物理文件至当前项目目录
  fs.writeFileSync(savedPath, buffer);

  const result: ProcessedAttachment = {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    size,
    type: file.type || 'application/octet-stream',
    ext,
    savedPath
  };

  const isImage = file.type?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext);

  if (isImage) {
    const mime = file.type || `image/${ext.replace('.', '')}`;
    result.dataUrl = `data:${mime};base64,${base64Data}`;
    result.extractedText = `[图像文件: ${file.name}, 大小: ${(size / 1024).toFixed(1)} KB]`;
    return result;
  }

  // 1. Word 文档 (.docx)
  if (ext === '.docx') {
    try {
      const docResult = await mammoth.extractRawText({ buffer });
      let text = docResult.value.trim();
      if (text.length > 12000) {
        text = text.slice(0, 12000) + `\n...(超出12000字符已截断，总长度约 ${docResult.value.length} 字符)`;
      }
      result.extractedText = text || '（Word 文档未包含可读取的纯文本）';
    } catch (err: any) {
      result.extractedText = `（Word 解析失败: ${err.message}）`;
    }
    return result;
  }

  // 2. PDF 文档 (.pdf)
  if (ext === '.pdf') {
    try {
      const pdfData = await pdfParse(buffer);
      let text = pdfData.text.trim();
      if (text.length > 12000) {
        text = text.slice(0, 12000) + `\n...(超出12000字符已截断，总页数 ${pdfData.numpages} 页)`;
      }
      result.extractedText = text || '（PDF 文档未包含可读取的纯文本）';
    } catch (err: any) {
      result.extractedText = `（PDF 解析失败: ${err.message}）`;
    }
    return result;
  }

  // 3. Excel 表格 (.xlsx, .xls, .csv)
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetSummaries: string[] = [];

      for (const sheetName of workbook.SheetNames.slice(0, 5)) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        const rows = csvContent.split('\n').filter(r => r.trim().length > 0);
        const displayRows = rows.slice(0, 40).join('\n');
        const truncatedNotice = rows.length > 40 ? `\n...[工作表 "${sheetName}" 共 ${rows.length} 行，展示前 40 行]` : '';
        sheetSummaries.push(`### 工作表: ${sheetName}\n\`\`\`csv\n${displayRows}${truncatedNotice}\n\`\`\``);
      }

      result.extractedText = sheetSummaries.join('\n\n') || '（Excel 文件未包含有效工作表数据）';
    } catch (err: any) {
      result.extractedText = `（Excel 解析失败: ${err.message}）`;
    }
    return result;
  }

  // 4. 常见纯文本或代码文件 (.txt, .md, .json, .py, .js, .ts, .html, .css, .yml, .yaml, .xml, .sql, .log)
  if (['.txt', '.md', '.json', '.py', '.js', '.ts', '.html', '.css', '.yml', '.yaml', '.xml', '.sql', '.log'].includes(ext)) {
    try {
      let text = buffer.toString('utf-8');
      if (text.length > 15000) {
        text = text.slice(0, 15000) + '\n...(文本超出15000字符已截断)';
      }
      result.extractedText = text;
    } catch {
      result.extractedText = `（文本读取异常）`;
    }
    return result;
  }

  result.extractedText = `[二进制附件: ${file.name}, 大小: ${(size / 1024).toFixed(1)} KB]`;
  return result;
}
