import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import type { CommissionPayout, SalesMember } from '../types/sales';
import { formatPKR } from '../data/seedData';

export async function generateQrDataUrl(url: string, width = 512): Promise<string> {
  return QRCode.toDataURL(url, {
    width,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#064e3b',
      light: '#ffffff',
    },
  });
}

export async function downloadSalesmanQrPng(member: Pick<SalesMember, 'fullName' | 'employeeId' | 'referralCode' | 'referralLink'>): Promise<void> {
  const dataUrl = await generateQrDataUrl(member.referralLink, 768);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `bazaarpk-qr-${member.referralCode.toLowerCase()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadSalesmanQrPdf(member: Pick<SalesMember, 'fullName' | 'employeeId' | 'phone' | 'city' | 'territory' | 'referralCode' | 'referralLink'>): Promise<void> {
  const qrDataUrl = await generateQrDataUrl(member.referralLink, 640);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  // Branded Emerald Header
  doc.setFillColor(6, 95, 70);
  doc.rect(0, 0, 148, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BazaarPK Cloud', 14, 17);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL MERCHANT ONBOARDING & REFERRAL CARD', 14, 25);

  // Body Heading
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to Launch Your Online Store', 74, 50, { align: 'center' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Scan the QR code below to register your business with assisted onboarding.', 74, 57, { align: 'center' });

  // QR Image Frame
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(36, 64, 76, 76, 4, 4, 'S');
  doc.addImage(qrDataUrl, 'PNG', 39, 67, 70, 70);

  // Referral Code Pill
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(24, 146, 100, 14, 3, 3, 'FD');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`REFERRAL CODE: ${member.referralCode}`, 74, 155, { align: 'center' });

  // Representative Details
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(member.fullName, 74, 172, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Employee ID: ${member.employeeId}  |  Territory: ${member.territory || member.city}`, 74, 179, { align: 'center' });
  doc.text(`Contact: ${member.phone}  |  City: ${member.city}`, 74, 185, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(member.referralLink, 74, 198, { align: 'center', maxWidth: 124 });

  doc.save(`bazaarpk-qr-card-${member.referralCode.toLowerCase()}.pdf`);
}

export function downloadPayoutStatementPdf(payout: CommissionPayout): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(6, 95, 70);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('BazaarPK Cloud — Sales Commission Payout Statement', 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Statement #: ${payout.payoutNumber}   |   Processed: ${new Date(payout.processedAt).toLocaleString()}`, 14, 24);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Payee Details', 14, 46);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Salesman: ${payout.salesmanName}`, 14, 54);
  doc.text(`Email: ${payout.salesmanEmail}`, 14, 61);
  doc.text(`Payment Method: ${payout.method.toUpperCase()}`, 14, 68);
  doc.text(`Account Title: ${payout.accountTitle}`, 14, 75);
  doc.text(`Account Number: ${payout.accountNumber}${payout.bankName ? ` (${payout.bankName})` : ''}`, 14, 82);
  doc.text(`Transaction Reference (TID): ${payout.transactionReference}`, 14, 89);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 98, 182, 26, 3, 3, 'FD');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Commission Paid', 22, 108);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text(formatPKR(payout.totalAmount), 22, 118);

  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(`Commission Ledger Entries Settled: ${payout.ledgerEntryIds.length}`, 120, 113);

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Authorized By: ${payout.processedBy}`, 14, 138);
  if (payout.notes) {
    doc.text(`Notes: ${payout.notes}`, 14, 146, { maxWidth: 182 });
  }

  doc.save(`payout-statement-${payout.payoutNumber.toLowerCase()}.pdf`);
}
