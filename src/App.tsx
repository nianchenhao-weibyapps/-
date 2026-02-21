/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { parse, differenceInMinutes, format } from 'date-fns';
import { Upload, DollarSign, Clock, Users, FileText, Trash2, AlertCircle, X, Calendar } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AttendanceRow {
  項次: string;
  姓名: string;
  員工編號: string;
  打卡日期: string;
  上班時間: string;
  下班時間: string;
  '打卡機號(上班／下班)': string;
}

interface EmployeeSummary {
  id: string;
  name: string;
  totalMinutes: number;
  records: {
    date: string;
    start: string;
    end: string;
    minutes: number;
  }[];
}

export default function App() {
  const [data, setData] = useState<AttendanceRow[]>([]);
  const [hourlyWage, setHourlyWage] = useState<number>(190); // Default minimum wage in Taiwan approx
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as AttendanceRow[];
        // Basic validation: check if required headers exist
        if (parsedData.length > 0 && parsedData[0].姓名 && parsedData[0].上班時間) {
          setData(parsedData);
        } else {
          alert('CSV 格式不正確，請確認包含「姓名」、「上班時間」、「下班時間」等欄位。');
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('解析 CSV 檔案時發生錯誤。');
      }
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      handleFileUpload(file);
    } else {
      alert('請上傳 CSV 檔案。');
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const employeeSummaries = useMemo(() => {
    const summaries: Record<string, EmployeeSummary> = {};

    data.forEach((row) => {
      const id = row.員工編號 || row.姓名;
      const name = row.姓名;
      
      if (!summaries[id]) {
        summaries[id] = { id, name, totalMinutes: 0, records: [] };
      }

      try {
        // Parse times. We assume the date is the same for start and end since it's a POS export for daily shifts.
        // If shifts cross midnight, this might need adjustment, but standard POS exports usually split them or provide full timestamps.
        const startTime = parse(row.上班時間, 'HH:mm', new Date());
        const endTime = parse(row.下班時間, 'HH:mm', new Date());
        
        let minutes = differenceInMinutes(endTime, startTime);
        
        // Handle shifts crossing midnight (if end time is earlier than start time)
        if (minutes < 0) {
          minutes += 24 * 60;
        }

        summaries[id].totalMinutes += minutes;
        summaries[id].records.push({
          date: row.打卡日期,
          start: row.上班時間,
          end: row.下班時間,
          minutes
        });
      } catch (e) {
        console.warn(`Row ${row.項次} has invalid time format:`, row);
      }
    });

    return Object.values(summaries).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [data]);

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} 小時 ${mins} 分鐘`;
  };

  const calculateSalary = (minutes: number) => {
    return Math.round((minutes / 60) * hourlyWage);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">員工出勤薪資計算</h1>
            <p className="text-zinc-500 mt-2">上傳 POS 匯出的 CSV 檔案，快速結算工時與薪資。</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-zinc-200">
            <div className="flex flex-col">
              <label htmlFor="wage" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                設定時薪 (TWD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  id="wage"
                  type="text"
                  inputMode="numeric"
                  value={hourlyWage}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '');
                    setHourlyWage(val === '' ? 0 : Number(val));
                  }}
                  className="pl-5 pr-2 py-1 text-xl font-medium focus:outline-none w-32"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        {data.length === 0 ? (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={cn(
              "relative group cursor-pointer transition-all duration-300",
              "border-2 border-dashed rounded-3xl p-12 md:p-24",
              "flex flex-col items-center justify-center text-center space-y-6",
              isDragging ? "border-zinc-900 bg-zinc-50 scale-[0.99]" : "border-zinc-200 bg-white hover:border-zinc-400"
            )}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-10 h-10 text-zinc-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold">點擊或拖曳 CSV 檔案至此</h3>
              <p className="text-zinc-400 max-w-sm mx-auto">
                支援 POS 系統匯出的標準格式，包含姓名、日期、上下班時間等資訊。
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-50 px-3 py-1.5 rounded-full">
              <FileText className="w-3 h-3" />
              ATTENDANCE_REPORT.CSV
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">總人數</span>
                </div>
                <div className="text-4xl font-bold">{employeeSummaries.length} <span className="text-lg font-normal text-zinc-400">人</span></div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <Clock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">總工時</span>
                </div>
                <div className="text-4xl font-bold">
                  {Math.floor(employeeSummaries.reduce((acc, curr) => acc + curr.totalMinutes, 0) / 60)} 
                  <span className="text-lg font-normal text-zinc-400"> 小時</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-50 rounded-xl">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">預估總薪資</span>
                </div>
                <div className="text-4xl font-bold">
                  ${employeeSummaries.reduce((acc, curr) => acc + calculateSalary(curr.totalMinutes), 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Employee Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
              <div className="p-6 border-bottom border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">員工結算清單</h2>
                <button 
                  onClick={() => setData([])}
                  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  清除資料
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-50/50 border-y border-zinc-100">
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">員工姓名 / 編號</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">出勤次數</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">總工時</th>
                      <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">預估薪資</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {employeeSummaries.map((emp) => (
                      <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="font-semibold text-lg">{emp.name}</div>
                          <div className="text-xs font-mono text-zinc-400">{emp.id}</div>
                        </td>
                        <td className="px-6 py-5">
                          <button 
                            onClick={() => setSelectedEmployee(emp)}
                            className="bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {emp.records.length} 次
                            <span className="text-[10px] bg-zinc-400 text-white px-1 rounded">查看</span>
                          </button>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-medium">{formatHours(emp.totalMinutes)}</div>
                          <div className="text-xs text-zinc-400">{(emp.totalMinutes / 60).toFixed(2)} 小時</div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="text-2xl font-bold text-zinc-900">
                            ${calculateSalary(emp.totalMinutes).toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-semibold mb-1">計算說明</p>
                <ul className="list-disc list-inside space-y-1 opacity-80">
                  <li>薪資計算公式：(總分鐘數 / 60) × 時薪，結果四捨五入至整數。</li>
                  <li>若下班時間早於上班時間，系統會自動判定為跨夜班（加 24 小時）。</li>
                  <li>請確保 CSV 檔案編碼為 UTF-8 以避免亂碼。</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEmployee(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h3 className="text-2xl font-bold">{selectedEmployee.name}</h3>
                  <p className="text-sm text-zinc-500">出勤明細紀錄 ({selectedEmployee.records.length} 筆)</p>
                </div>
                <button 
                  onClick={() => setSelectedEmployee(null)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {selectedEmployee.records.map((record, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 bg-white hover:border-zinc-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div>
                          <div className="font-semibold">{record.date}</div>
                          <div className="text-sm text-zinc-500 flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {record.start} - {record.end}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-medium text-zinc-900">
                          {formatHours(record.minutes)}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {(record.minutes / 60).toFixed(1)} 小時
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                <div className="flex gap-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">總計時數</div>
                    <div className="text-lg font-bold">{formatHours(selectedEmployee.totalMinutes)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">預估薪資</div>
                    <div className="text-lg font-bold text-emerald-600">${calculateSalary(selectedEmployee.totalMinutes).toLocaleString()}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEmployee(null)}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
