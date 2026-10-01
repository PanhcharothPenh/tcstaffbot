import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Attendance, Staff, Branch } from '../types';
import { calculateWorkHours } from '../utils';
import { KHMER_ORNAMENT_BASE64 } from '../khmerOrnamentBase64';

export interface AttendancePdfParams {
  title?: string;
  periodType: 'month' | 'year' | 'custom';
  month?: number;
  year: number;
  startDate?: string;
  endDate?: string;
  staff?: Staff | null;
  branch?: Branch | null;
  records: Attendance[];
  generatedBy?: string;
}

export async function generateAttendancePdf(params: AttendancePdfParams) {
  const {
    periodType,
    month = new Date().getMonth() + 1,
    year,
    startDate,
    endDate,
    staff,
    branch,
    records,
    generatedBy = 'Admin'
  } = params;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // 1. Month / Period Text
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  let periodText = '';
  if (periodType === 'month') {
    periodText = `${monthNames[month - 1]} ${year}`;
  } else if (periodType === 'year') {
    periodText = `Year ${year}`;
  } else {
    periodText = `${startDate || ''} to ${endDate || ''}`;
  }

  // 2. Metrics Calculation
  const totalDays = records.length;
  let totalHours = 0;
  let totalOtHours = 0;
  let presentCount = 0;
  let lateCount = 0;
  let totalLateMinutes = 0;
  let absentCount = 0;
  let completedCount = 0;

  records.forEach(r => {
    const hours = (r.workHours !== undefined && r.workHours !== null && r.workHours > 0) ? r.workHours : calculateWorkHours(r.checkIn, r.checkOut, r.status);
    totalHours += hours;
    totalOtHours += r.overtimeHours || 0;
    if (r.status === 'Present' || r.status === 'Working') presentCount++;
    if (r.status === 'Completed') completedCount++;
    if (r.status === 'Late' || Number(r.lateMinutes || 0) > 0) {
      lateCount++;
      totalLateMinutes += Number(r.lateMinutes || 0);
    }
    if (r.status === 'Absent') absentCount++;
  });

  // Helper duration formatter
  const formatLatePdf = (mins?: number): string => {
    if (!mins || isNaN(mins) || mins <= 0) return '0m';
    const totalMins = Math.round(mins);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatPdfDuration = (hours?: number): string => {
    if (hours === undefined || hours === null || isNaN(hours) || hours === 0) return '0h';
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // 3. Official Kingdom Motto (Centered, no system name, branch, address, phone on header)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('KINGDOM OF CAMBODIA', pageWidth / 2, 13, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text('Nation  Religion  King', pageWidth / 2, 17, { align: 'center' });
  
  // Ornate Divider Image
  const ornamentWidth = 36;
  const ornamentHeight = (22 / 231) * ornamentWidth; // ~3.4mm
  pdf.addImage(KHMER_ORNAMENT_BASE64, 'PNG', (pageWidth - ornamentWidth) / 2, 18.5, ornamentWidth, ornamentHeight);

  // 4. Document Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text('STAFF ATTENDANCE & WORKING HOURS LEDGER', pageWidth / 2, 29, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Period: ${periodText}`, pageWidth / 2, 34, { align: 'center' });

  // 5. Staff / Report Scope Metadata (Clean Line, NO BOXES)
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.line(14, 38, pageWidth - 14, 38);

  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Staff Name: ', 14, 43);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  const staffNameStr = staff ? `${staff.fullName} (${staff.position || 'Staff'})` : 'All Staff';
  pdf.text(staffNameStr, 32, 43);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Branch: ', pageWidth / 2 - 25, 43);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  const branchNameStr = branch ? branch.branchName : 'All Branches';
  pdf.text(branchNameStr, pageWidth / 2 - 12, 43);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Generated: ', pageWidth - 42, 43);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(new Date().toLocaleDateString('en-GB'), pageWidth - 14, 43, { align: 'right' });

  pdf.line(14, 46.5, pageWidth - 14, 46.5);

  // 6. Attendance Records Table (Starts directly at Y=49, NO SUMMARY BOXES)
  const tableRows = records.map((r, index) => {
    const d = new Date(r.date);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = isNaN(d.getTime()) ? '' : dayNames[d.getDay()];

    let statusDisplay: string = r.status || 'Present';
    if (r.status === 'Late' || Number(r.lateMinutes || 0) > 0) {
      statusDisplay = r.lateMinutes && r.lateMinutes > 0 
        ? `Late (${formatLatePdf(r.lateMinutes)})` 
        : 'Late';
    }

    return [
      String(index + 1),
      `${r.date} (${dayOfWeek})`,
      staff ? (r.shiftType || 'Full-Time') : (r.staffName || 'Staff'),
      r.checkIn || '--',
      r.checkOut || '--',
      formatPdfDuration((r.workHours !== undefined && r.workHours !== null && r.workHours > 0) ? r.workHours : calculateWorkHours(r.checkIn, r.checkOut, r.status)),
      r.overtimeHours ? `${r.overtimeHours}h` : '0h',
      statusDisplay,
      r.source === 'telegram' ? 'Telegram' : 'Manual'
    ];
  });

  autoTable(pdf, {
    startY: 49,
    margin: { left: 14, right: 14 },
    head: [[
      '#',
      'Date',
      staff ? 'Shift' : 'Employee Name',
      'Check In',
      'Check Out',
      'Work Hrs',
      'OT Hrs',
      'Status',
      'Source'
    ]],
    foot: [[
      '',
      'TOTAL:',
      `${totalDays} Days`,
      '',
      '',
      formatPdfDuration(totalHours),
      `${totalOtHours.toFixed(1)}h`,
      lateCount > 0 ? `Late: ${lateCount} (${formatLatePdf(totalLateMinutes)})` : 'All On-Time',
      ''
    ]],
    showFoot: 'lastPage',
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
      lineColor: [148, 163, 184],
      cellPadding: 2.5
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.3,
      lineColor: [100, 116, 139]
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineWidth: 0.1,
      lineColor: [226, 232, 240]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 26 },
      2: { halign: 'left', cellWidth: staff ? 22 : 34 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 26 },
      8: { halign: 'center', cellWidth: 20 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageNum = pdf.internal.pages.length - 1;
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `TC Staff Management System • Confidential Staff Attendance Report`,
        14,
        pageHeight - 8
      );
      pdf.text(
        `Page ${data.pageNumber}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }
  });

  // 7. Signature Block at the end
  let finalY = (pdf as any).lastAutoTable.finalY + 12;
  if (finalY > pageHeight - 35) {
    pdf.addPage();
    finalY = 25;
  }

  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);

  pdf.text('PREPARED BY', 30, finalY);
  pdf.line(20, finalY + 16, 65, finalY + 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('HR / Store Supervisor', 25, finalY + 20);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(30, 41, 59);
  pdf.text('APPROVED BY', pageWidth - 55, finalY);
  pdf.line(pageWidth - 65, finalY + 16, pageWidth - 20, finalY + 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Branch Manager / Owner', pageWidth - 60, finalY + 20);

  // 8. Output Filename
  const safeStaffName = staff ? staff.fullName.replace(/\s+/g, '_') : 'All_Staff';
  const safePeriod = periodType === 'month' ? `${monthString(month)}_${year}` : String(year);
  const fileName = `TC_Staff_Attendance_${safeStaffName}_${safePeriod}.pdf`;

  pdf.save(fileName);
}

function monthString(m: number): string {
  return String(m).padStart(2, '0');
}