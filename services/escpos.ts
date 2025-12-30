
import { Order } from '../types';

const ESC = 0x1B;
const GS = 0x1D;

const commands = {
  INIT: [ESC, 0x40],
  CUT: [GS, 0x56, 0x41, 0x00],
  BEEP: [ESC, 0x42, 0x03, 0x02], // Beep 3 times, duration 2
  TEXT_FORMAT: {
    NORMAL: [ESC, 0x21, 0x00],
    BOLD: [ESC, 0x21, 0x08],
    DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
    DOUBLE_WIDTH: [ESC, 0x21, 0x20],
    DOUBLE_BOTH: [ESC, 0x21, 0x30],
  },
  ALIGN: {
    LEFT: [ESC, 0x61, 0x00],
    CENTER: [ESC, 0x61, 0x01],
    RIGHT: [ESC, 0x61, 0x02],
  },
  LF: [0x0A],
};

export class ReceiptBuilder {
  private buffer: number[] = [];
  // Standard 80mm thermal paper usually supports 48 columns (Font A) or 64 (Font B).
  // We use 48 as a safe standard for 80mm printers.
  private width: number = 48; 

  constructor() {
    this.buffer.push(...commands.INIT);
  }

  init() {
    this.buffer.push(...commands.INIT);
    return this;
  }

  beep() {
    this.buffer.push(...commands.BEEP);
    return this;
  }

  add(bytes: number[]) {
    this.buffer.push(...bytes);
    return this;
  }

  text(text: string) {
    if (!text) return this;
    const str = String(text);
    
    // Basic ASCII normalization: remove accents for broader printer compatibility
    // In a real production app for Vietnam, you would render the receipt to an image (Canvas)
    // and print the image bytes to support full Unicode/Fonts.
    const normalized = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (let i = 0; i < normalized.length; i++) {
      // Filter non-printable ASCII
      const code = normalized.charCodeAt(i);
      if (code >= 32 && code <= 126) {
          this.buffer.push(code);
      } else {
          this.buffer.push(0x3F); // '?' for unknown
      }
    }
    return this;
  }

  textLine(text: string) {
    this.text(text);
    this.buffer.push(...commands.LF);
    return this;
  }

  align(alignment: 'left' | 'center' | 'right') {
    if (alignment === 'left') this.buffer.push(...commands.ALIGN.LEFT);
    if (alignment === 'center') this.buffer.push(...commands.ALIGN.CENTER);
    if (alignment === 'right') this.buffer.push(...commands.ALIGN.RIGHT);
    return this;
  }

  bold(enable: boolean) {
    this.buffer.push(...(enable ? commands.TEXT_FORMAT.BOLD : commands.TEXT_FORMAT.NORMAL));
    return this;
  }
  
  size(size: 'normal' | 'large') {
      this.buffer.push(...(size === 'large' ? commands.TEXT_FORMAT.DOUBLE_BOTH : commands.TEXT_FORMAT.NORMAL));
      return this;
  }

  feed(lines: number = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(...commands.LF);
    }
    return this;
  }

  cut() {
    this.feed(5); // Increased feed to ensure paper clears the cutter
    this.buffer.push(...commands.CUT);
    return this;
  }

  line() {
      this.textLine('-'.repeat(this.width));
      return this;
  }

  // Creates a Key......Value line
  pair(left: string, right: string) {
      const safeLeft = String(left || '');
      const safeRight = String(right || '');
      
      // Calculate length based on normalized string
      const leftLen = safeLeft.normalize("NFD").replace(/[\u0300-\u036f]/g, "").length;
      const rightLen = safeRight.normalize("NFD").replace(/[\u0300-\u036f]/g, "").length;
      
      const spaces = this.width - leftLen - rightLen;
      
      if (spaces > 0) {
          this.text(safeLeft + ' '.repeat(spaces) + safeRight);
      } else {
          // If too long, wrap
          this.text(safeLeft + ' ' + safeRight);
      }
      this.buffer.push(...commands.LF);
      return this;
  }

  // Specialized format for items: "2x  ItemName ...... Price"
  itemLine(qty: number, name: string, price: string) {
      const qtyStr = `${qty}x `;
      const priceStr = price;
      
      const qtyLen = qtyStr.length;
      const priceLen = priceStr.length;
      
      // Available space for name
      const maxNameLen = this.width - qtyLen - priceLen - 1; // -1 for min space
      
      let safeName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (safeName.length > maxNameLen) {
          // Truncate name if absolutely necessary, but preferably wrap in future iterations.
          // For now, let's truncate to keep one line per item for speed.
          safeName = safeName.substring(0, maxNameLen);
      }

      const spacing = this.width - qtyLen - safeName.length - priceLen;
      this.text(qtyStr + safeName + ' '.repeat(Math.max(1, spacing)) + priceStr);
      this.buffer.push(...commands.LF);
      return this;
  }

  toBytes() {
    return new Uint8Array(this.buffer);
  }
}

export const generateOrderReceipt = (order: Order): Uint8Array => {
    const builder = new ReceiptBuilder();
    
    // --- Header Section ---
    builder.init()
           .beep()
           .align('center')
           .bold(true).size('large').textLine('Thong Dong F&B').size('normal').bold(false)
           .textLine('27 to 4, Dong Anh')
           .feed(1)
           .bold(true).textLine('HOA DON / RECEIPT').bold(false)
           .line()
           
    // --- Order Info Section (Left Aligned for scanning) ---
           .align('left')
           .pair(`Order: #${order.id.slice(-6)}`, `Date: ${new Date(order.date).toLocaleDateString('en-GB')}`)
           .pair(`Staff: Admin`, `Time: ${new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`)
           
    // --- Table (Highlighted) ---
           .feed(1)
           .bold(true).size('large').textLine(`Table: ${order.table}`).size('normal').bold(false)
           .line();

    // --- Item List ---
    // Header
    builder.bold(true).itemLine(0, "ITEM", "TOTAL").bold(false).text("").feed(0); // Hack to clear line buffer
    
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const lineTotal = (item.quantity * (item.price || 0)); 
            // Note: price isn't in OrderItem in the type definition in some contexts, 
            // assuming we can calculate or it's passed. If price is missing, we skip.
            // For now, assuming standard item line.
            
            // Note: DBOrder/Order type might not carry price per item in the items array strictly
            // depending on implementation. In the POS page, we calculate it. 
            // We'll rely on the total if individual prices aren't stored, 
            // but the mockup showed prices. We will assume consistency.
            
            builder.itemLine(item.quantity, item.name, ""); // Just print qty and name for now if price unknown per line
            
            // If notes exist
            if (item.notes) {
                builder.textLine(`   (Note: ${item.notes})`);
            }
        });
    } else {
        builder.textLine('No items');
    }

    builder.line();

    // --- Totals Section ---
    builder.align('right');
    
    // Calculate subtotal/discount display
    if (order.discount && order.discount > 0) {
        builder.textLine(`Subtotal: ${(order.total / (1 - order.discount/100)).toLocaleString()} d`);
        builder.textLine(`Discount: ${order.discount}%`);
    }
    
    builder.bold(true).size('large').pair('TOTAL:', `${order.total.toLocaleString()} d`).size('normal').bold(false);
    
    builder.feed(1);
    builder.textLine(`Payment: ${order.paymentMethod?.toUpperCase() || 'CASH'}`);

    // --- Footer ---
    builder.feed(2)
           .align('center')
           .textLine('Cam on quy khach!')
           .textLine('Wifi: ThongDong_Guest / Pass: 88888888')
           .cut();

    return builder.toBytes();
};

export const generateTestReceipt = (): Uint8Array => {
    const builder = new ReceiptBuilder();
    builder.init()
           .beep()
           .align('center')
           .bold(true).size('large').textLine('Thong Dong F&B').size('normal').bold(false)
           .textLine('PRINTER TEST')
           .feed(1)
           .line()
           .align('left')
           .textLine('If you can read this,')
           .textLine('the printer is working.')
           .feed(1)
           .align('center')
           .bold(true).textLine('80mm READY').bold(false)
           .feed(2)
           .cut();
    return builder.toBytes();
};
