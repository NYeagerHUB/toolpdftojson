import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileUp, 
  FileJson, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Copy, 
  Trash2,
  FileText,
  Eye,
  Code
} from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { digitizePdfStream } from './services/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper component to render text with LaTeX
const FormattedText = ({ text }: { text: string }) => {
  if (!text) return null;
  
  // Split text by math delimiters
  const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/gs);
  
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [rawText, setRawText] = useState<string>('');
  const [error, setError] = useState<{ message: string; code?: string; link?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'json' | 'preview'>('json');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setProgress(0);
      setStatusText('');
    } else {
      setError('Vui lòng chọn file PDF hợp lệ.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  } as any);

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setRawText('');
    setProgress(5);
    setStatusText('Đang đọc file PDF...');

    // Progress simulation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 30) return prev + 2;
        if (prev < 70) return prev + 1;
        if (prev < 90) return prev + 0.5;
        return prev;
      });
    }, 200);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      setProgress(35);
      setStatusText('Đang kết nối với AI...');

      let accumulatedText = '';
      const stream = digitizePdfStream(base64Data, file.type);
      
      setStatusText('AI đang phân tích và điền dữ liệu...');
      
      for await (const chunk of stream) {
        accumulatedText += chunk;
        setRawText(accumulatedText);
        // Try to parse partial JSON to show structure if possible, 
        // but for now just showing raw text is better for the "filling in" effect
      }

      const finalData = JSON.parse(accumulatedText);
      setResult(finalData);
      
      clearInterval(progressInterval);
      setProgress(100);
      setStatusText('Hoàn tất!');
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      
      let errorMessage = 'Đã có lỗi xảy ra trong quá trình xử lý.';
      let errorCode = err.code || err.status;
      let troubleshootingLink = 'https://ai.google.dev/gemini-api/docs/troubleshooting';

      if (err.message?.includes('API key')) {
        errorMessage = 'Lỗi xác thực: API Key không hợp lệ hoặc đã hết hạn.';
      } else if (err.message?.includes('quota')) {
        errorMessage = 'Lỗi giới hạn: Bạn đã hết hạn mức sử dụng API miễn phí.';
      } else if (err.message?.includes('safety')) {
        errorMessage = 'Lỗi nội dung: PDF chứa nội dung bị chặn bởi bộ lọc an toàn của AI.';
      }

      setError({
        message: errorMessage,
        code: errorCode,
        link: troubleshootingLink
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace('.pdf', '') || 'quiz'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
            <FileJson className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Số hóa PDF sang JSON</h1>
          <p className="text-gray-500 text-lg">Chuyển đổi tài liệu trắc nghiệm PDF thành dữ liệu JSON cấu trúc chuẩn.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Upload & Controls */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileUp className="w-5 h-5 text-indigo-600" />
                Tải lên tài liệu
              </h2>
              
              {!file ? (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
                    isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-400 hover:bg-gray-50"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <FileUp className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium">Kéo thả file PDF vào đây</p>
                    <p className="text-gray-400 text-sm mt-1">hoặc click để chọn file</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button 
                      onClick={reset}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Xóa file"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className={cn(
                      "w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg",
                      isProcessing 
                        ? "bg-indigo-400 cursor-not-allowed" 
                        : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-200"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Bắt đầu số hóa
                      </>
                    )}
                  </button>

                  {isProcessing && (
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-xs font-medium text-indigo-600">
                        <span>{statusText}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">{error.message}</p>
                    {error.code && <p className="text-xs mt-1 opacity-70">Mã lỗi: {error.code}</p>}
                    {error.link && (
                      <a 
                        href={error.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs mt-2 inline-block text-indigo-600 hover:underline font-medium"
                      >
                        Xem hướng dẫn khắc phục sự cố →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-2">Hướng dẫn sử dụng</h3>
              <ul className="text-sm text-indigo-700 space-y-2 list-disc list-inside">
                <li>Tải lên file PDF chứa các câu hỏi trắc nghiệm, đúng sai, điền khuyết hoặc nối cột.</li>
                <li>Nhấn "Bắt đầu số hóa" để AI phân tích và trích xuất dữ liệu.</li>
                <li>Kiểm tra kết quả JSON ở cột bên phải.</li>
                <li>Sao chép hoặc tải về file JSON để sử dụng.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Result Preview */}
          <div className="h-full">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col min-h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    {viewMode === 'json' ? <FileJson className="w-5 h-5 text-indigo-600" /> : <Eye className="w-5 h-5 text-indigo-600" />}
                    {viewMode === 'json' ? 'Kết quả JSON' : 'Xem trước'}
                  </h2>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      onClick={() => setViewMode('json')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                        viewMode === 'json' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <Code className="w-3.5 h-3.5" />
                      JSON
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                        viewMode === 'preview' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                  </div>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 flex items-center gap-2 text-sm font-medium"
                      title="Sao chép"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Đã chép' : 'Sao chép'}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600 flex items-center gap-2 text-sm font-medium"
                      title="Tải về"
                    >
                      <Download className="w-4 h-4" />
                      Tải về
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 bg-gray-900 rounded-2xl p-4 overflow-auto font-mono text-sm relative group">
                {viewMode === 'json' ? (
                  rawText ? (
                    <pre className="text-indigo-300 whitespace-pre-wrap">
                      {rawText}
                      {isProcessing && <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-1" />}
                    </pre>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                      <FileJson className="w-12 h-12 mb-3 opacity-20" />
                      <p>Chưa có dữ liệu</p>
                    </div>
                  )
                ) : (
                  <div className="bg-white rounded-xl p-6 font-sans text-gray-800 h-full overflow-auto">
                    {result?.questions ? (
                      <div className="space-y-8">
                        {result.questions.map((q: any, idx: number) => (
                          <div key={idx} className="border-b border-gray-100 pb-6 last:border-0">
                            <div className="flex gap-3 mb-4">
                              <span className="flex-shrink-0 w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                                {idx + 1}
                              </span>
                              <div className="text-lg font-medium leading-relaxed">
                                <FormattedText text={q.question} />
                              </div>
                            </div>

                            {q.type === 'mcq' && q.options && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-11">
                                {q.options.map((opt: string, optIdx: number) => (
                                  <div 
                                    key={optIdx} 
                                    className={cn(
                                      "p-3 rounded-xl border transition-all flex items-center gap-3",
                                      q.answer === String(optIdx) 
                                        ? "bg-green-50 border-green-200 text-green-800" 
                                        : "bg-gray-50 border-gray-100"
                                    )}
                                  >
                                    <span className="w-6 h-6 rounded-md bg-white border border-inherit flex items-center justify-center text-xs font-bold">
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <FormattedText text={opt} />
                                  </div>
                                ))}
                              </div>
                            )}

                            {q.type === 'truefalse' && q.statements && (
                              <div className="space-y-3 ml-11">
                                {q.statements.map((s: string, sIdx: number) => (
                                  <div key={sIdx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex-1 mr-4">
                                      <FormattedText text={s} />
                                    </div>
                                    <span className={cn(
                                      "px-3 py-1 rounded-lg text-xs font-bold uppercase",
                                      q.answers?.[sIdx] === 'D' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    )}>
                                      {q.answers?.[sIdx] === 'D' ? 'Đúng' : 'Sai'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {q.type === 'short' && (
                              <div className="ml-11">
                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                  <p className="text-xs text-indigo-400 uppercase font-bold mb-1">Đáp án:</p>
                                  <p className="font-medium text-indigo-900">
                                    <FormattedText text={q.answer} />
                                  </p>
                                </div>
                              </div>
                            )}

                            {q.type === 'matching' && q.left && (
                              <div className="ml-11 space-y-2">
                                {q.left.map((l: string, lIdx: number) => (
                                  <div key={lIdx} className="flex items-center gap-4">
                                    <div className="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                                      <FormattedText text={l} />
                                    </div>
                                    <div className="text-indigo-400">→</div>
                                    <div className="flex-1 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-sm font-medium">
                                      <FormattedText text={q.right?.[q.answers?.[lIdx]] || '...'} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Eye className="w-12 h-12 mb-3 opacity-20" />
                        <p>Chưa có dữ liệu để xem trước</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-400 text-sm">
          <p>© 2024 PDF Digitizer AI. Powered by Google Gemini.</p>
        </footer>
      </div>
    </div>
  );
}
