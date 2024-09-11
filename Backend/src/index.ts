import express from 'express';
import fs from 'fs';
import decompress from 'decompress';
import { createCanvas, loadImage } from 'canvas';
import cors from 'cors';

const app = express();
app.use(cors());
const port = 3000;

const canvas = createCanvas(3600, 1800);
const context = canvas.getContext('2d');

const interpolate = (min: number, max: number, factor: number) => min + (max - min) * factor;

// Функція для перетворення кольору з HEX в RGB
const hexToRgb = (hex: string) => {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

// Функція для перетворення кольору з RGB в HEX
const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (val: number) => val.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Контрольні точки температур та кольорів
const colorStops = [
  { temp: 0, color: '#0000ff' }, // Синій для низької температури
  { temp: 15, color: '#2e7de1' }, // Світло-синій
  { temp: 30, color: '#539dfb' }, // Світло-блакитний
  { temp: 45, color: '#46e5bd' }, // Бірюзовий
  { temp: 60, color: '#99e546' }, // Світло-зелений
  { temp: 75, color: '#e5db46' }, // Жовтий
  { temp: 90, color: '#ff7f00' }, // Помаранчевий для високої температури
];

// Основна функція для отримання кольору
const getColor = (temp: number) => {
  if (temp < 0 || temp > 90) return '#0000ff00'; // Прозорий для поза межами

  // Знаходимо дві найближчі контрольні точки
  for (let i = 0; i < colorStops.length - 1; i++) {
    const lower = colorStops[i];
    const upper = colorStops[i + 1];

    if (temp >= lower.temp && temp <= upper.temp) {
      // Інтерполюємо колір між двома точками
      const factor = (temp - lower.temp) / (upper.temp - lower.temp);
      const lowerRgb = hexToRgb(lower.color);
      const upperRgb = hexToRgb(upper.color);

      const r = Math.round(interpolate(lowerRgb[0], upperRgb[0], factor));
      const g = Math.round(interpolate(lowerRgb[1], upperRgb[1], factor));
      const b = Math.round(interpolate(lowerRgb[2], upperRgb[2], factor));

      return rgbToHex(r, g, b);
    }
  }
  return '#0000ff00';
};

const drawOnCanvas = async (data: number[][]) => {
  const image = await loadImage('././images/empty-map.jpg');
  context.drawImage(image, 0, 0);
  for (let i = 0; i < 1800; i++) {
    for (let j = 0; j < 3600; j++) {
      const style = getColor(data[i][j]);
      context.fillStyle = style;
      context.fillRect(j, i, 1, 1);
    }
  }

  const buffer = canvas.toBuffer('image/png');

  fs.writeFileSync('././images/test-output.png', buffer);

  const dataUrl = canvas.toDataURL();
  console.log(buffer);

  return buffer;
};

const readBinary = async (cb: Function) => {
  const BINARY_DIMENSION_X = 36000;
  const BINARY_DIMENSION_Y = 18000;
  const CHUNK_SIZE = 4 * 1024;

  let matrix = Array.from({ length: BINARY_DIMENSION_Y }, () => new Uint8Array(BINARY_DIMENSION_X));

  let currentRow = 0;
  let currentCol = 0;

  const readStream = fs.createReadStream('././testOutput/sst.grid', { highWaterMark: CHUNK_SIZE });

  readStream.on('data', (chunk: Uint8Array) => {
    const numBytes = chunk.byteLength;
    const byteArray = new Uint8Array(chunk.buffer, chunk.byteOffset, numBytes);
    for (let i = 0; i < byteArray.length; i++) {
      if (currentCol >= BINARY_DIMENSION_X) {
        currentCol = 0;
        currentRow++;
      }
      if (currentRow < BINARY_DIMENSION_Y) {
        matrix[currentRow][currentCol] = byteArray[i];
        currentCol++;
      } else {
        readStream.close();
        break;
      }
    }
  });

  readStream.on('end', async () => {
    const compressedData = compressData(matrix, 3600, 1800);
    const image = await drawOnCanvas(compressedData);
    return cb(image);
  });
};

const compressData = (data: Uint8Array[], newWidth: number, newHeight: number) => {
  const compressed = Array.from({ length: newHeight }, () => new Array(newWidth).fill(0));
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = 0; dy < 10; dy++) {
        for (let dx = 0; dx < 10; dx++) {
          const oldY = y * 10 + dy;
          const oldX = x * 10 + dx;
          //if (data[oldY][oldX] !== 255) {
          sum += data[oldY][oldX];
          count++;
          //       }
        }
      }
      compressed[y][x] = sum / count;
    }
  }
  compressed.reverse();
  return compressed;
};

const readZip = async () => {
  await decompress('././testData/sst.grid.zip', '././testOutput');
};

app.get('/', async (req, res) => {
  await readBinary((image: Buffer) => {
    res.json({ image: image.toString('base64') });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
