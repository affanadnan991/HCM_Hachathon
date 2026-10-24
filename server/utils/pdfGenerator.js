import PDFDocument from 'pdfkit';

export function generatePayslipPdf(payslip, companySettings, callback) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    callback(null, pdfData);
  });

  // Primary Colors
  const primaryColor = '#4f46e5';
  const textColor = '#1e293b';
  const mutedColor = '#64748b';
  const borderColor = '#cbd5e1';

  // 1. Header & Company Profile
  doc.rect(40, 40, 515, 60).fill('#f8fafc');
  doc.fillColor(primaryColor).fontSize(18).font('Helvetica-Bold').text(companySettings.company_name || 'HCM Lite Technologies', 55, 52);
  doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text('CONFIDENTIAL MONTHLY SALARY PAYSLIP', 55, 74);

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const periodText = `${monthNames[payslip.month]} ${payslip.year}`;
  doc.fillColor(textColor).fontSize(11).font('Helvetica-Bold').text(periodText, 400, 55, { align: 'right' });
  doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text(`Run Status: ${payslip.run_status || 'FINALIZED'}`, 400, 72, { align: 'right' });

  // 2. Employee Details Grid
  doc.moveDown(3);
  const startY = 115;
  doc.rect(40, startY, 515, 65).stroke(borderColor);

  doc.fillColor(mutedColor).fontSize(8).text('EMPLOYEE NAME', 55, startY + 10);
  doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(`${payslip.first_name} ${payslip.last_name}`, 55, startY + 22);

  doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('EMPLOYEE CODE', 220, startY + 10);
  doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(payslip.employee_code, 220, startY + 22);

  doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('DEPARTMENT', 380, startY + 10);
  doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(payslip.department_name || 'General', 380, startY + 22);

  doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('DESIGNATION', 55, startY + 40);
  doc.fillColor(textColor).fontSize(9).font('Helvetica').text(payslip.designation_title || 'Staff Member', 55, startY + 50);

  doc.fillColor(mutedColor).fontSize(8).text('DAYS WORKED / TOTAL', 220, startY + 40);
  doc.fillColor(textColor).fontSize(9).text(`${payslip.days_worked} / ${payslip.working_days_in_month} Working Days`, 220, startY + 50);

  doc.fillColor(mutedColor).fontSize(8).text('ABSENT / HALF DAYS', 380, startY + 40);
  doc.fillColor(textColor).fontSize(9).text(`${payslip.absent_days} Absent, ${payslip.half_days} Half Days`, 380, startY + 50);

  // 3. Earnings & Deductions Tables
  const tableY = 195;

  // Earnings Header
  doc.rect(40, tableY, 250, 22).fill('#f1f5f9');
  doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold').text('EARNINGS & ALLOWANCES', 50, tableY + 6);
  doc.text('AMOUNT (PKR)', 200, tableY + 6, { align: 'right' });

  // Deductions Header
  doc.rect(305, tableY, 250, 22).fill('#f1f5f9');
  doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold').text('DEDUCTIONS & TAX', 315, tableY + 6);
  doc.text('AMOUNT (PKR)', 465, tableY + 6, { align: 'right' });

  // Earnings Rows
  let curY = tableY + 30;
  const earnings = [
    { label: 'Basic Salary', val: payslip.basic_salary },
    { label: 'House Rent Allowance (HRA 40%)', val: payslip.hra_allowance },
    { label: 'Medical Allowance (10%)', val: payslip.medical_allowance }
  ];

  earnings.forEach(e => {
    doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text(e.label, 50, curY);
    doc.fillColor(textColor).font('Helvetica-Bold').text(Number(e.val).toLocaleString(), 200, curY, { align: 'right' });
    curY += 20;
  });

  // Deductions Rows
  let dedY = tableY + 30;
  const deductions = [
    { label: `Attendance Deductions (${payslip.absent_days} abs, ${payslip.half_days} half)`, val: (payslip.unpaid_deduction || 0) + (payslip.half_day_deduction || 0) },
    { label: 'Income Tax Deduction (Annual Slab)', val: payslip.tax_deduction }
  ];

  if (payslip.late_penalty_deduction > 0) {
    deductions.push({
      label: `Late Penalty (${payslip.late_count || 0} lates, 3-late=0.5d)`,
      val: payslip.late_penalty_deduction
    });
  }

  deductions.forEach(d => {
    doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text(d.label, 315, dedY);
    doc.fillColor(textColor).font('Helvetica-Bold').text(Number(d.val).toLocaleString(), 465, dedY, { align: 'right' });
    dedY += 20;
  });

  // Subtotal lines
  const subtotalY = 270;
  doc.rect(40, subtotalY, 250, 24).fill('#e2e8f0');
  doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9).text('GROSS SALARY (1.5x Basic)', 50, subtotalY + 7);
  doc.text(`PKR ${Number(payslip.gross_salary).toLocaleString()}`, 200, subtotalY + 7, { align: 'right' });

  doc.rect(305, subtotalY, 250, 24).fill('#e2e8f0');
  doc.fillColor(textColor).font('Helvetica-Bold').fontSize(9).text('TOTAL DEDUCTIONS', 315, subtotalY + 7);
  doc.text(`PKR ${Number(payslip.total_deductions).toLocaleString()}`, 465, subtotalY + 7, { align: 'right' });

  // 4. Net Salary Big Box
  const netY = 320;
  doc.rect(40, netY, 515, 60).fill('#4f46e5');
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica').text('NET TAKE-HOME SALARY', 60, netY + 15);
  doc.fontSize(20).font('Helvetica-Bold').text(`PKR ${Number(payslip.net_salary).toLocaleString()}`, 60, netY + 30);
  doc.fontSize(8).font('Helvetica').text('Computer Generated • No Signature Required', 370, netY + 26, { align: 'right' });

  // Footer
  doc.fillColor(mutedColor).fontSize(7).text(`Generated by HCM Lite System on ${new Date().toISOString()}`, 40, 780, { align: 'center' });

  doc.end();
}
