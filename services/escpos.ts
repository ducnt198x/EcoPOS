
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
      this.textLine('--------------------------------');
      return this;
  }

  pair(left: string, right: string) {
      // Assuming 32 char width for 58mm printer compatibility
      const width = 32;
      const safeLeft = String(left || '');
      const safeRight = String(right || '');
      
      // Calculate simplistic length based on normalized string to guess spacing
      const leftLen = safeLeft.normalize("NFD").replace(/[\u0300-\u036f]/g, "").length;
      const rightLen = safeRight.normalize("NFD").replace(/[\u0300-\u036f]/g, "").length;
      
      const spaces = width - leftLen - rightLen;
      
      if (spaces > 0) {
          this.text(safeLeft + ' '.repeat(spaces) + safeRight);
      } else {
          // If too long, just space them out, printer will wrap
          this.text(safeLeft + ' ' + safeRight);
      }
      this.buffer.push(...commands.LF);
      return this;
  }

  toBytes() {
    return new Uint8Array(this.buffer);
  }
}

export const generateOrderReceipt = (order: Order): Uint8Array => {
    const builder = new ReceiptBuilder();
    
    builder.init()
           .beep() // Add beep to alert kitchen/cashier
           .align('center')
           .bold(true).size('large').textLine('EcoPOS').size('normal').bold(false)
           .textLine('Phieu Thanh Toan') // Vietnamese friendly (unsigned)
           .feed(1)
           
           .align('left')
           .textLine(`Order: #${order.id.slice(0, 8)}`)
           .textLine(`Date: ${new Date(order.date).toLocaleDateString()} ${new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`)
           .textLine(`Table: ${order.table}`)
           .textLine(`Type: ${order.orderType?.toUpperCase() || 'DINE-IN'}`)
           .line();

    // Items
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            builder.textLine(`${item.quantity}x ${item.name}`);
        });
    } else {
        builder.textLine('No items');
    }

    builder.line();

    if (order.discount) {
        builder.pair('Discount:', `${order.discount}%`);
    }
    
    // Total
    builder.bold(true).size('large').pair('TOTAL:', `${order.total.toLocaleString()} d`).size('normal').bold(false);
    
    builder.feed(1)
           .align('center')
           .textLine('Cam on quy khach!')
           .textLine('Wifi: EcoPOS_Guest')
           .cut();

    return builder.toBytes();
};

export const generateTestReceipt = (): Uint8Array => {
    const builder = new ReceiptBuilder();
    builder.init()
           .beep()
           .align('center')
           .bold(true).size('large').textLine('EcoPOS Printer Test').size('normal').bold(false)
           .feed(1)
           .align('left')
           .textLine('Connection: OK')
           .textLine(`Time: ${new Date().toLocaleTimeString()}`)
           .line()
           .textLine('May in da san sang!')
           .feed(2)
           .cut();
    return builder.toBytes();
};
