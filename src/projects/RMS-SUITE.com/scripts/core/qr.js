/*
 * QRCode generator for JavaScript (ES Module conversion)
 * Based on qrcode.js (MIT License) by Kazuhiko Arase
 */

const QR_MODE = { NUMBER: 1, ALPHA_NUM: 2, BYTE: 4, KANJI: 8 };
const QR_ERROR_CORRECT_LEVEL = { L: 1, M: 0, Q: 3, H: 2 };
const QR_MASK_PATTERN = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7,
};

const PAD0 = 0xec;
const PAD1 = 0x11;

const ALPHA_NUM = {
  0: 36,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  A: 10,
  B: 11,
  C: 12,
  D: 13,
  E: 14,
  F: 15,
  G: 16,
  H: 17,
  I: 18,
  J: 19,
  K: 20,
  L: 21,
  M: 22,
  N: 23,
  O: 24,
  P: 25,
  Q: 26,
  R: 27,
  S: 28,
  T: 29,
  U: 30,
  V: 31,
  W: 32,
  X: 33,
  Y: 34,
  Z: 35,
  ' ': 36,
  $: 37,
  '%': 38,
  '*': 39,
  '+': 40,
  '-': 41,
  '.': 42,
  '/': 43,
  ':': 44,
};

function getMode(s) {
  if (/^[0-9]*$/.test(s)) return QR_MODE.NUMBER;
  if (/^[0-9A-Z $%*+\-./:]*$/.test(s)) return QR_MODE.ALPHA_NUM;
  return QR_MODE.BYTE;
}

function stringToBytes(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6));
      bytes.push(0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12));
      bytes.push(0x80 | ((code >> 6) & 0x3f));
      bytes.push(0x80 | (code & 0x3f));
    } else {
      i += 1;
      const surrogate = 0x10000 + (((code & 0x3ff) << 10) | (s.charCodeAt(i) & 0x3ff));
      bytes.push(0xf0 | (surrogate >> 18));
      bytes.push(0x80 | ((surrogate >> 12) & 0x3f));
      bytes.push(0x80 | ((surrogate >> 6) & 0x3f));
      bytes.push(0x80 | (surrogate & 0x3f));
    }
  }
  return bytes;
}

class QRPolynomial {
  constructor(num, shift) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset += 1;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i += 1) {
      this.num[i] = num[i + offset];
    }
  }

  get(index) {
    return this.num[index];
  }

  get length() {
    return this.num.length;
  }

  multiply(e) {
    const num = new Array(this.length + e.length - 1).fill(0);
    for (let i = 0; i < this.length; i += 1) {
      for (let j = 0; j < e.length; j += 1) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  }

  mod(e) {
    if (this.length - e.length < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = this.num.slice();
    for (let i = 0; i < e.length; i += 1) {
      num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(e);
  }
}

class QRRSBlock {
  static getRSBlocks(typeNumber, errorCorrectLevel) {
    const level = errorCorrectLevel; // 1=L, 0=M, 3=Q, 2=H
    const table = QRRSBlock.RS_TABLE[typeNumber];
    if (!table) throw new Error(`Unsupported typeNumber: ${typeNumber}`);
    const spec = table[level];
    if (!spec) throw new Error(`Unsupported EC level: ${level}`);
    const list = [];
    for (const [count, totalCount, dataCount] of spec) {
      for (let j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
    }
    return list;
  }
  constructor(totalCount, dataCount) {
    this.totalCount = totalCount;
    this.dataCount = dataCount;
  }
}

/*
  RS_TABLE compacte (versions 1–10) d'après la spécification QR.
  Clé = typeNumber, valeur = { [level]: [[count,total,data], ...] }
  Niveaux (clé) : 1=L, 0=M, 3=Q, 2=H
*/
QRRSBlock.RS_TABLE = {
  1: {
    1: [[1, 26, 19]],
    0: [[1, 26, 16]],
    3: [[1, 26, 13]],
    2: [[1, 26, 9]],
  },
  2: {
    1: [[1, 44, 34]],
    0: [[1, 44, 28]],
    3: [[1, 44, 22]],
    2: [[1, 44, 16]],
  },
  3: {
    1: [[1, 70, 55]],
    0: [[1, 70, 44]],
    3: [[2, 35, 17]],
    2: [[2, 35, 13]],
  },
  4: {
    1: [[1, 100, 80]],
    0: [[2, 50, 32]],
    3: [[2, 50, 24]],
    2: [[4, 25, 9]],
  },
  5: {
    1: [[1, 134, 108]],
    0: [[2, 67, 43]],
    3: [[2, 33, 15], [2, 34, 16]],
    2: [[2, 33, 11], [2, 34, 12]],
  },
  6: {
    1: [[2, 86, 68]],
    0: [[4, 43, 27]],
    3: [[4, 43, 19]],
    2: [[4, 43, 15]],
  },
  7: {
    1: [[2, 98, 78]],
    0: [[4, 49, 31]],
    3: [[2, 32, 14], [4, 33, 15]],
    2: [[4, 39, 13], [1, 40, 14]],
  },
  8: {
    1: [[2, 121, 97]],
    0: [[2, 60, 38], [2, 61, 39]],
    3: [[4, 40, 18], [2, 41, 19]],
    2: [[4, 40, 14], [2, 41, 15]],
  },
  9: {
    1: [[2, 146, 116]],
    0: [[3, 58, 36], [2, 59, 37]],
    3: [[4, 36, 16], [4, 37, 17]],
    2: [[4, 36, 12], [4, 37, 13]],
  },
  10: {
    1: [[2, 86, 68], [2, 87, 69]],
    0: [[4, 69, 43], [1, 70, 44]],
    3: [[6, 43, 19], [2, 44, 20]],
    2: [[6, 43, 15], [2, 44, 16]],
  },
};

const QRMath = {
  EXP_TABLE: new Array(256),
  LOG_TABLE: new Array(256),
  glog(n) {
    if (n < 1) throw new Error(`glog(${n})`);
    return QRMath.LOG_TABLE[n];
  },
  gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return QRMath.EXP_TABLE[n];
  },
};

for (let i = 0; i < 8; i += 1) {
  QRMath.EXP_TABLE[i] = 1 << i;
}
for (let i = 8; i < 256; i += 1) {
  QRMath.EXP_TABLE[i] =
    QRMath.EXP_TABLE[i - 4] ^
    QRMath.EXP_TABLE[i - 5] ^
    QRMath.EXP_TABLE[i - 6] ^
    QRMath.EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i += 1) {
  QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
}

class QRBitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }

  get(index) {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  }

  put(num, length) {
    for (let i = 0; i < length; i += 1) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length += 1;
  }
}

class QR8bitByte {
  constructor(data) {
    this.mode = QR_MODE.BYTE;
    this.data = data;
    this.parsedData = stringToBytes(data);
  }

  getLength() {
    return this.parsedData.length;
  }

  write(buffer) {
    this.parsedData.forEach((b) => buffer.put(b, 8));
  }
}

class QRCodeModel {
  constructor(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }

  addData(data) {
    const newData = new QR8bitByte(data);
    this.dataList.push(newData);
    this.dataCache = null;
  }

  isDark(row, col) {
    return this.modules[row][col];
  }

  getModuleCount() {
    return this.moduleCount;
  }

  make() {
    if (this.typeNumber < 1) {
      let typeNumber = 1;
      for (; typeNumber < 40; typeNumber += 1) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
        const buffer = new QRBitBuffer();
        this.dataList.forEach((data) => {
          buffer.put(data.mode, 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
          data.write(buffer);
        });
        let totalDataCount = 0;
        rsBlocks.forEach((block) => {
          totalDataCount += block.dataCount;
        });
        if (buffer.length <= totalDataCount * 8) {
          this.typeNumber = typeNumber;
          break;
        }
      }
    }
    this.makeImpl(false, this.getBestMaskPattern());
  }

  makeImpl(test, maskPattern) {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = Array.from({ length: this.moduleCount }, () => new Array(this.moduleCount));
    QRUtil.setupPositionProbePattern(this, 0, 0);
    QRUtil.setupPositionProbePattern(this, this.moduleCount - 7, 0);
    QRUtil.setupPositionProbePattern(this, 0, this.moduleCount - 7);
    QRUtil.setupPositionAdjustPattern(this);
    QRUtil.setupTimingPattern(this);
    QRUtil.setupTypeInfo(this, test, maskPattern);
    if (this.typeNumber >= 7) {
      QRUtil.setupTypeNumber(this, test);
    }
    if (this.dataCache === null) {
      this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
    }
    QRCodeModel.mapData(this.dataCache, maskPattern, this);
  }

  getBestMaskPattern() {
    let minLostPoint = Infinity;
    let pattern = 0;
    for (let i = 0; i < 8; i += 1) {
      this.makeImpl(true, i);
      const lostPoint = QRUtil.getLostPoint(this);
      if (lostPoint < minLostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  }

  static createData(typeNumber, errorCorrectLevel, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    const buffer = new QRBitBuffer();
    dataList.forEach((data) => {
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
      data.write(buffer);
    });
    let totalDataCount = 0;
    rsBlocks.forEach((block) => {
      totalDataCount += block.dataCount;
    });
    if (buffer.length > totalDataCount * 8) {
      throw new Error("code length overflow");
    }
    if (buffer.length + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    while (buffer.length < totalDataCount * 8) {
      buffer.put(PAD0, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(PAD1, 8);
    }
    const data = new Array(totalDataCount);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = 0xff & buffer.buffer[i];
    }
    let offset = 0;
    const blocks = rsBlocks.map((block) => {
      const dataCount = block.dataCount;
      const totalCount = block.totalCount;
      const d = data.slice(offset, offset + dataCount);
      offset += dataCount;
      const rsPoly = QRUtil.getErrorCorrectPolynomial(totalCount - dataCount);
      const mod = new QRPolynomial(d, rsPoly.length - 1).mod(rsPoly);
      return {
        data: d,
        ecc: Array.from({ length: rsPoly.length - 1 }, (_, idx) => mod.get(idx)),
      };
    });
    const interleaved = [];
    const maxDataLength = Math.max(...blocks.map((b) => b.data.length));
    for (let i = 0; i < maxDataLength; i += 1) {
      blocks.forEach((block) => {
        if (i < block.data.length) interleaved.push(block.data[i]);
      });
    }
    const maxEccLength = Math.max(...blocks.map((b) => b.ecc.length));
    for (let i = 0; i < maxEccLength; i += 1) {
      blocks.forEach((block) => {
        if (i < block.ecc.length) interleaved.push(block.ecc[i]);
      });
    }
    return interleaved;
  }

  static mapData(data, maskPattern, qr) {
    let inc = -1;
    let row = qr.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    for (let col = qr.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      for (;;) {
        for (let c = 0; c < 2; c += 1) {
          if (qr.modules[row][col - c] === undefined) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (QRUtil.getMask(maskPattern, row, col - c)) dark = !dark;
            qr.modules[row][col - c] = dark;
            bitIndex -= 1;
            if (bitIndex === -1) {
              byteIndex += 1;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || row >= qr.moduleCount) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
}

const QRUtil = {
  PATTERN_POSITION_TABLE: [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
  ],

  getBCHTypeInfo(data) {
    let d = data << 10;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x537) >= 0) {
      d ^= 0x537 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x537));
    }
    return ((data << 10) | d) ^ 0x5412;
  },

  getBCHTypeNumber(data) {
    let d = data << 12;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x1f25) >= 0) {
      d ^= 0x1f25 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x1f25));
    }
    return (data << 12) | d;
  },

  getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) {
      digit += 1;
      data >>>= 1;
    }
    return digit;
  },

  getPatternPosition(typeNumber) {
    return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
  },

  getMask(maskPattern, i, j) {
    switch (maskPattern) {
      case QR_MASK_PATTERN.PATTERN000:
        return (i + j) % 2 === 0;
      case QR_MASK_PATTERN.PATTERN001:
        return i % 2 === 0;
      case QR_MASK_PATTERN.PATTERN010:
        return j % 3 === 0;
      case QR_MASK_PATTERN.PATTERN011:
        return (i + j) % 3 === 0;
      case QR_MASK_PATTERN.PATTERN100:
        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case QR_MASK_PATTERN.PATTERN101:
        return ((i * j) % 2) + ((i * j) % 3) === 0;
      case QR_MASK_PATTERN.PATTERN110:
        return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case QR_MASK_PATTERN.PATTERN111:
        return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
      default:
        return false;
    }
  },

  getLostPoint(qr) {
    let lostPoint = 0;
    const moduleCount = qr.moduleCount;
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        let sameCount = 0;
        const dark = qr.isDark(row, col);
        for (let r = -1; r <= 1; r += 1) {
          if (row + r < 0 || moduleCount <= row + r) continue;
          for (let c = -1; c <= 1; c += 1) {
            if (col + c < 0 || moduleCount <= col + c) continue;
            if (r === 0 && c === 0) continue;
            if (dark === qr.isDark(row + r, col + c)) sameCount += 1;
          }
        }
        if (sameCount > 5) lostPoint += 3 + sameCount - 5;
      }
    }
    for (let row = 0; row < moduleCount - 1; row += 1) {
      for (let col = 0; col < moduleCount - 1; col += 1) {
        const darkCount = [0, 0, 0, 0].reduce((sum, _, idx) => {
          const r = row + Math.floor(idx / 2);
          const c = col + (idx % 2);
          return sum + (qr.isDark(r, c) ? 1 : 0);
        }, 0);
        if (darkCount === 0 || darkCount === 4) lostPoint += 3;
      }
    }
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount - 6; col += 1) {
        if (
          qr.isDark(row, col) &&
          !qr.isDark(row, col + 1) &&
          qr.isDark(row, col + 2) &&
          qr.isDark(row, col + 3) &&
          qr.isDark(row, col + 4) &&
          !qr.isDark(row, col + 5) &&
          qr.isDark(row, col + 6)
        ) {
          lostPoint += 40;
        }
      }
    }
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount - 6; row += 1) {
        if (
          qr.isDark(row, col) &&
          !qr.isDark(row + 1, col) &&
          qr.isDark(row + 2, col) &&
          qr.isDark(row + 3, col) &&
          qr.isDark(row + 4, col) &&
          !qr.isDark(row + 5, col) &&
          qr.isDark(row + 6, col)
        ) {
          lostPoint += 40;
        }
      }
    }
    let darkCount = 0;
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount; row += 1) {
        if (qr.isDark(row, col)) darkCount += 1;
      }
    }
    const ratio = Math.abs((darkCount / moduleCount / moduleCount) * 100 - 50) / 5;
    lostPoint += ratio * 10;
    return lostPoint;
  },

  setupPositionProbePattern(qr, row, col) {
    for (let r = -1; r <= 7; r += 1) {
      if (row + r <= -1 || qr.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c += 1) {
        if (col + c <= -1 || qr.moduleCount <= col + c) continue;
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          qr.modules[row + r][col + c] = true;
        } else {
          qr.modules[row + r][col + c] = false;
        }
      }
    }
  },

  setupTimingPattern(qr) {
    for (let i = 0; i < qr.moduleCount; i += 1) {
      const bit = i % 2 === 0;
      if (qr.modules[6][i] === undefined) qr.modules[6][i] = bit;
      if (qr.modules[i][6] === undefined) qr.modules[i][6] = bit;
    }
  },

  setupPositionAdjustPattern(qr) {
    const pos = QRUtil.getPatternPosition(qr.typeNumber);
    pos.forEach((row) => {
      pos.forEach((col) => {
        if (qr.modules[row][col] !== undefined) return;
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
              qr.modules[row + r][col + c] = true;
            } else {
              qr.modules[row + r][col + c] = false;
            }
          }
        }
      });
    });
  },

  setupTypeNumber(qr, test) {
    const bits = QRUtil.getBCHTypeNumber(qr.typeNumber);
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && ((bits >> i) & 1) === 1;
      qr.modules[Math.floor(i / 3)][(i % 3) + qr.moduleCount - 8 - 3] = mod;
      qr.modules[(i % 3) + qr.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  },

  setupTypeInfo(qr, test, maskPattern) {
    const data =
      (qr.errorCorrectLevel << 3) | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) qr.modules[i][8] = mod;
      else if (i < 8) qr.modules[i + 1][8] = mod;
      else qr.modules[qr.moduleCount - 15 + i][8] = mod;
      const mod2 = !test && ((bits >> i) & 1) === 1;
      if (i < 8) qr.modules[8][qr.moduleCount - i - 1] = mod2;
      else if (i < 9) qr.modules[8][15 - i] = mod2;
      else qr.modules[8][15 - i - 1] = mod2;
    }
    qr.modules[qr.moduleCount - 8][8] = !test;
  },

  getLengthInBits(mode, type) {
    if (1 <= type && type < 10) {
      switch (mode) {
        case QR_MODE.NUMBER:
          return 10;
        case QR_MODE.ALPHA_NUM:
          return 9;
        default:
          return 8;
      }
    }
    if (type < 27) {
      switch (mode) {
        case QR_MODE.NUMBER:
          return 12;
        case QR_MODE.ALPHA_NUM:
          return 11;
        default:
          return 16;
      }
    }
    switch (mode) {
      case QR_MODE.NUMBER:
        return 14;
      case QR_MODE.ALPHA_NUM:
        return 13;
      default:
        return 16;
    }
  },

  getErrorCorrectPolynomial(errorCorrectLength) {
    let poly = new QRPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i += 1) {
      poly = poly.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
    }
    return poly;
  },
};

// Dessine un QR code minimaliste ou un placeholder si l'URL est absente
export function drawQRCode(canvas, text) {
  if (!canvas) return;

  const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const MIN_CSS_SIZE = 256;
  const baseSize =
    Number(canvas.dataset.baseSize) ||
    Number(canvas.getAttribute("width")) ||
    canvas.clientWidth ||
    Number(canvas.getAttribute("height")) ||
    MIN_CSS_SIZE;
  const initialSize = Math.max(MIN_CSS_SIZE, baseSize);
  canvas.dataset.baseSize = String(initialSize);

  const applySize = (target) => {
    const cssSize = Math.max(MIN_CSS_SIZE, Math.round(target));
    const currentSize = Number(canvas.dataset.cssSize);
    const ratioChanged = canvas.dataset.pixelRatio !== String(ratio);
    if (cssSize !== currentSize || ratioChanged) {
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;
      canvas.width = Math.round(cssSize * ratio);
      canvas.height = Math.round(cssSize * ratio);
      canvas.dataset.cssSize = String(cssSize);
      canvas.dataset.pixelRatio = String(ratio);
      canvas.style.imageRendering = "pixelated";
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(ratio, ratio);
    ctx.imageSmoothingEnabled = false;
    return { ctx, cssSize };
  };

  const validText = typeof text === "string" && /^https?:\/\/\S+$/i.test(text.trim());

  if (!validText) {
    const prepared = applySize(initialSize);
    if (!prepared) return;
    let { ctx, cssSize } = prepared;
    ctx.fillStyle = "#f2f4f8";
    ctx.fillRect(0, 0, cssSize, cssSize);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("QR", cssSize / 2, cssSize / 2);
    return;
  }

  try {
    const qr = new QRCodeModel(0, QR_ERROR_CORRECT_LEVEL.M);
    qr.addData(text);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const quietZone = 4;
    const minModulePx = 5;
    const cellsTotal = moduleCount + quietZone * 2;
    const requiredSize = cellsTotal * minModulePx;
    const targetSize = Math.max(initialSize, requiredSize);

    const prepared = applySize(targetSize);
    if (!prepared) return;
    let { ctx, cssSize } = prepared;

    let cellSize = Math.floor(cssSize / cellsTotal);
    if (cellSize < minModulePx) {
      cellSize = minModulePx;
      const expandedSize = cellSize * cellsTotal;
      const preparedScaled = applySize(expandedSize);
      if (!preparedScaled) return;
      ctx = preparedScaled.ctx;
      cssSize = preparedScaled.cssSize;
    }
    const totalDrawSize = cellSize * cellsTotal;
    const margin = Math.floor((cssSize - totalDrawSize) / 2);
    const start = margin + quietZone * cellSize;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssSize, cssSize);
    ctx.fillStyle = "#000000";

    for (let r = 0; r < moduleCount; r += 1) {
      for (let c = 0; c < moduleCount; c += 1) {
        if (qr.isDark(r, c)) {
          const x = start + c * cellSize;
          const y = start + r * cellSize;
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }
  } catch (error) {
    console.error("QR generation failed", error);
    const prepared = applySize(initialSize);
    if (!prepared) return;
    let { ctx, cssSize } = prepared;
    ctx.fillStyle = "#f2f4f8";
    ctx.fillRect(0, 0, cssSize, cssSize);
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("QR error", cssSize / 2, cssSize / 2);
  }
}
