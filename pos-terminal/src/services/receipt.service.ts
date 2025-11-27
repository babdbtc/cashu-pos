/**
 * Receipt Service
 *
 * Generates and manages payment receipts for tax compliance
 * and customer records.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { Payment } from '@/types/payment';

export interface ReceiptData {
  // Transaction info
  transactionId: string;
  timestamp: Date;

  // Merchant info
  merchantName: string;
  terminalName: string;
  terminalId: string;

  // Payment info
  fiatAmount: number;
  fiatCurrency: string;
  satsAmount: number;
  exchangeRate: number;

  // Optional
  tipAmount?: number;
  changeGiven?: number;
  customerNote?: string;
  staffName?: string;
}

export interface ReceiptOptions {
  includeQrCode?: boolean;
  includeTaxInfo?: boolean;
  language?: string;
}

class ReceiptService {
  private receiptCounter = 0;

  /**
   * Generate a receipt from payment data
   */
  generateReceipt(payment: Payment, merchantInfo: {
    merchantName: string;
    terminalName: string;
    terminalId: string;
  }): ReceiptData {
    return {
      transactionId: payment.transactionId || payment.id,
      timestamp: payment.completedAt || payment.createdAt,
      merchantName: merchantInfo.merchantName,
      terminalName: merchantInfo.terminalName,
      terminalId: merchantInfo.terminalId,
      fiatAmount: payment.fiatAmount,
      fiatCurrency: payment.fiatCurrency,
      satsAmount: payment.satsAmount,
      exchangeRate: payment.exchangeRate || 0,
      tipAmount: payment.overpayment?.handling === 'tip'
        ? payment.overpayment.amount
        : undefined,
      changeGiven: payment.overpayment?.handling === 'change'
        ? payment.overpayment.amount
        : undefined,
    };
  }

  /**
   * Format receipt as plain text
   */
  formatAsText(receipt: ReceiptData): string {
    const lines: string[] = [];
    const width = 40;
    const separator = '─'.repeat(width);
    const doubleSeparator = '═'.repeat(width);

    // Header
    lines.push(doubleSeparator);
    lines.push(this.center(receipt.merchantName.toUpperCase(), width));
    lines.push(this.center('PAYMENT RECEIPT', width));
    lines.push(doubleSeparator);

    // Transaction details
    lines.push('');
    lines.push(`Date: ${this.formatDate(receipt.timestamp)}`);
    lines.push(`Time: ${this.formatTime(receipt.timestamp)}`);
    lines.push(`Terminal: ${receipt.terminalName}`);
    lines.push(`Transaction: ${receipt.transactionId.slice(0, 16)}...`);
    lines.push('');
    lines.push(separator);

    // Payment amount
    lines.push('');
    lines.push(this.rightAlign(
      `${this.formatCurrency(receipt.fiatAmount, receipt.fiatCurrency)}`,
      width
    ));
    lines.push(this.rightAlign(
      `${this.formatSats(receipt.satsAmount)}`,
      width,
      '(secondary)'
    ));
    lines.push('');

    // Exchange rate
    lines.push(`Rate: 1 BTC = ${receipt.exchangeRate.toLocaleString()} ${receipt.fiatCurrency}`);

    // Tip if applicable
    if (receipt.tipAmount) {
      lines.push('');
      lines.push(separator);
      lines.push(`Tip: ${this.formatSats(receipt.tipAmount)}`);
    }

    // Change if applicable
    if (receipt.changeGiven) {
      lines.push('');
      lines.push(separator);
      lines.push(`Change returned: ${this.formatSats(receipt.changeGiven)}`);
    }

    // Footer
    lines.push('');
    lines.push(doubleSeparator);
    lines.push(this.center('PAID WITH CASHU', width));
    lines.push(this.center('Thank you!', width));
    lines.push(doubleSeparator);

    return lines.join('\n');
  }

  /**
   * Format receipt as HTML for printing
   */
  formatAsHtml(receipt: ReceiptData, options: ReceiptOptions = {}): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-width: 300px;
      margin: 0 auto;
      padding: 20px;
      background: white;
    }
    .receipt {
      border: 1px dashed #ccc;
      padding: 15px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .merchant-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .receipt-title {
      font-size: 12px;
      margin-top: 5px;
    }
    .details {
      margin: 10px 0;
      padding: 10px 0;
      border-bottom: 1px dashed #ccc;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .amount-section {
      text-align: right;
      padding: 15px 0;
      border-bottom: 1px dashed #ccc;
    }
    .fiat-amount {
      font-size: 24px;
      font-weight: bold;
    }
    .sats-amount {
      font-size: 14px;
      color: #666;
    }
    .rate-info {
      font-size: 10px;
      color: #888;
      margin-top: 5px;
    }
    .extras {
      padding: 10px 0;
      border-bottom: 1px dashed #ccc;
    }
    .footer {
      text-align: center;
      padding-top: 15px;
      font-size: 11px;
    }
    .cashu-badge {
      background: #f7931a;
      color: white;
      padding: 5px 10px;
      border-radius: 3px;
      display: inline-block;
      margin-bottom: 5px;
    }
    .thank-you {
      margin-top: 10px;
      font-style: italic;
    }
    ${options.includeTaxInfo ? `
    .tax-info {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #ccc;
      font-size: 10px;
      color: #666;
    }
    ` : ''}
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="merchant-name">${this.escapeHtml(receipt.merchantName)}</div>
      <div class="receipt-title">Payment Receipt</div>
    </div>

    <div class="details">
      <div class="detail-row">
        <span>Date:</span>
        <span>${this.formatDate(receipt.timestamp)}</span>
      </div>
      <div class="detail-row">
        <span>Time:</span>
        <span>${this.formatTime(receipt.timestamp)}</span>
      </div>
      <div class="detail-row">
        <span>Terminal:</span>
        <span>${this.escapeHtml(receipt.terminalName)}</span>
      </div>
      <div class="detail-row">
        <span>Transaction:</span>
        <span>${receipt.transactionId.slice(0, 12)}...</span>
      </div>
    </div>

    <div class="amount-section">
      <div class="fiat-amount">${this.formatCurrency(receipt.fiatAmount, receipt.fiatCurrency)}</div>
      <div class="sats-amount">${this.formatSats(receipt.satsAmount)}</div>
      <div class="rate-info">Rate: 1 BTC = ${receipt.exchangeRate.toLocaleString()} ${receipt.fiatCurrency}</div>
    </div>

    ${receipt.tipAmount || receipt.changeGiven ? `
    <div class="extras">
      ${receipt.tipAmount ? `
      <div class="detail-row">
        <span>Tip:</span>
        <span>${this.formatSats(receipt.tipAmount)}</span>
      </div>
      ` : ''}
      ${receipt.changeGiven ? `
      <div class="detail-row">
        <span>Change:</span>
        <span>${this.formatSats(receipt.changeGiven)}</span>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <div class="footer">
      <div class="cashu-badge">PAID WITH CASHU</div>
      <div class="thank-you">Thank you for your payment!</div>
    </div>

    ${options.includeTaxInfo ? `
    <div class="tax-info">
      <p>This receipt is valid documentation for tax purposes.</p>
      <p>Amount in ${receipt.fiatCurrency} calculated at time of payment.</p>
    </div>
    ` : ''}
  </div>
</body>
</html>
    `;
  }

  /**
   * Print receipt
   */
  async printReceipt(receipt: ReceiptData, options: ReceiptOptions = {}): Promise<boolean> {
    try {
      const html = this.formatAsHtml(receipt, options);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('Failed to print receipt:', error);
      return false;
    }
  }

  /**
   * Share receipt as PDF
   */
  async shareReceipt(receipt: ReceiptData, options: ReceiptOptions = {}): Promise<boolean> {
    try {
      const html = this.formatAsHtml(receipt, options);
      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Receipt',
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to share receipt:', error);
      return false;
    }
  }

  /**
   * Save receipt to local storage
   */
  async saveReceipt(receipt: ReceiptData): Promise<string | null> {
    try {
      const filename = `receipt_${receipt.transactionId}_${Date.now()}.json`;
      const directory = `${FileSystem.documentDirectory}receipts/`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }

      const filepath = `${directory}${filename}`;
      await FileSystem.writeAsStringAsync(filepath, JSON.stringify(receipt, null, 2));

      return filepath;
    } catch (error) {
      console.error('Failed to save receipt:', error);
      return null;
    }
  }

  /**
   * Load saved receipts
   */
  async loadReceipts(): Promise<ReceiptData[]> {
    try {
      const directory = `${FileSystem.documentDirectory}receipts/`;
      const dirInfo = await FileSystem.getInfoAsync(directory);

      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(directory);
      const receipts: ReceiptData[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await FileSystem.readAsStringAsync(`${directory}${file}`);
          const receipt = JSON.parse(content);
          receipt.timestamp = new Date(receipt.timestamp);
          receipts.push(receipt);
        }
      }

      // Sort by timestamp, newest first
      receipts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return receipts;
    } catch (error) {
      console.error('Failed to load receipts:', error);
      return [];
    }
  }

  /**
   * Generate CSV export of receipts for accounting
   */
  generateCsvExport(receipts: ReceiptData[]): string {
    const headers = [
      'Transaction ID',
      'Date',
      'Time',
      'Merchant',
      'Terminal',
      'Fiat Amount',
      'Currency',
      'Sats Amount',
      'Exchange Rate',
      'Tip (sats)',
      'Change (sats)',
    ];

    const rows = receipts.map(r => [
      r.transactionId,
      this.formatDate(r.timestamp),
      this.formatTime(r.timestamp),
      r.merchantName,
      r.terminalName,
      r.fiatAmount.toFixed(2),
      r.fiatCurrency,
      r.satsAmount.toString(),
      r.exchangeRate.toFixed(2),
      r.tipAmount?.toString() || '',
      r.changeGiven?.toString() || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // Helper methods

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  private formatSats(amount: number): string {
    return `${amount.toLocaleString()} sats`;
  }

  private center(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  private rightAlign(text: string, width: number, prefix?: string): string {
    const fullText = prefix ? `${prefix} ${text}` : text;
    const padding = Math.max(0, width - fullText.length);
    return ' '.repeat(padding) + fullText;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Export singleton instance
export const receiptService = new ReceiptService();

// Export class for testing
export { ReceiptService };
