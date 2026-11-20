import { useEffect, useRef, type CSSProperties } from 'react';
import type { Buy } from '../../lib/types';
import { useImage } from './Dream';

const MODELS = [
  ['cola', /coca[\s-]*cola|кока[\s-]*кола|(?:^|\s)кол[аыу](?:$|\s)/u, 2],
  ['phone', /телефон|смартфон|iphone|pixel|galaxy|redmi|чехол/u, 223],
  ['earbuds', /airdots|airpods|earbuds|вкладыш/u, 214],
  ['headphones', /наушник|headphones|гарнитур/u, 265],
  ['bottle', /бутыл|шампун|напит|сок|духи|парфюм|термос/u, 163],
  ['screen', /ноутбук|macbook|монитор|телевизор|ipad|планшет/u, 201],
  ['shoe', /кроссов|ботин|обув|туфл|sneaker/u, 25],
  ['jacket', /куртк|пуховик|пальто|ветровк/u, 192],
  ['desk', /(?:^|\s)стол(?:ик)?(?:$|\s)/u, 31],
] as const;

export function BuyArt({ buy }: { buy: Buy }) {
  const title = buy.title.trim();
  const photo = useImage(buy.autoPic ? undefined : buy.imgId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [model, , hue] = MODELS.find(([, match]) => match.test(title.toLowerCase())) ?? ['parcel', null, 208];
  const source = photo ?? (model === 'cola' ? `${import.meta.env.BASE_URL}purchase-cola.webp` : null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) paint(ctx, model, hue, title);
  }, [hue, model, source, title]);

  return (
    <span className="purchase-art" style={{ '--art-hue': hue } as CSSProperties} aria-hidden="true">
      {source ? <img className={!photo || buy.cut ? 'is-cut' : undefined} src={source} alt="" draggable={false} /> : (
        <canvas ref={canvas} width={480} height={440} />
      )}
    </span>
  );
}

type Model = typeof MODELS[number][0] | 'parcel';

function paint(ctx: CanvasRenderingContext2D, model: Model, hue: number, title: string) {
  const tone = (l: number, s = 56) => `hsl(${hue} ${s}% ${l}%)`;
  const metal = (x: number, width: number, colors: string[]) => {
    const fill = ctx.createLinearGradient(x, 0, x + width, 0);
    colors.forEach((color, i) => fill.addColorStop(i / (colors.length - 1), color));
    return fill;
  };
  const body = (x: number, y: number, w: number, h: number, radius: number, fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const ellipse = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const text = (label: string, y: number, font: string, width: number) => {
    ctx.fillStyle = '#fff';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, y, width);
  };

  ctx.clearRect(0, 0, 480, 440);
  ctx.save();
  ctx.translate(240, 220);
  ctx.filter = 'blur(17px)';
  ellipse(10, 140, 124, 22, 'rgba(4, 7, 13, .46)');
  ctx.filter = 'none';
  ctx.rotate(-0.13);

  if (model === 'bottle') {
    body(-75, -111, 150, 252, 39, metal(-75, 150, [tone(21), tone(55, 89), tone(45, 82), tone(19)]));
    ellipse(0, -108, 68, 12, '#9da6b2');
    body(-31, -154, 62, 54, 9, '#34434a');
    body(-75, -47, 150, 115, 5, metal(-75, 150, [tone(25), tone(47), tone(30)]));
    text(title, 14, 'bold 20px system-ui', 124);
  } else if (model === 'phone') {
    body(-83, -148, 166, 296, 28, metal(-83, 166, ['#141923', '#9caabf', '#273143']));
    body(-77, -142, 154, 284, 24, metal(-77, 154, [tone(24), tone(48), tone(17)]));
    body(-65, -130, 70, 70, 20, tone(27));
    ellipse(-44, -108, 12, 12, '#0c111c');
    ellipse(-18, -84, 12, 12, '#0c111c');
    ellipse(-47, -111, 4, 4, '#a9c6f2');
    ellipse(-21, -87, 4, 4, '#a9c6f2');
  } else if (model === 'earbuds') {
    const ceramic = metal(-116, 232, ['#aebbcf', '#fbfdff', '#e9edf6', '#aebbcf']);
    body(-116, -50, 232, 172, 55, ceramic);
    body(-107, -46, 214, 35, 15, '#6f7f96');
    for (const x of [-53, 53]) {
      body(x - 16, -102, 32, 95, 14, '#e7edf7');
      ellipse(x, -113, 36, 28, '#f9fbff');
      ellipse(x, -118, 15, 6, '#364152');
    }
    body(-110, -20, 220, 137, 48, ceramic);
    ellipse(0, 31, 4, 4, '#61b08a');
  } else if (model === 'headphones') {
    ctx.beginPath();
    ctx.arc(0, 0, 93, Math.PI, Math.PI * 2);
    ctx.lineWidth = 25;
    ctx.strokeStyle = metal(-100, 200, [tone(27), tone(68), tone(38)]);
    ctx.stroke();
    body(-113, -17, 57, 119, 26, metal(-113, 57, [tone(20), tone(55), tone(31)]));
    body(56, -17, 57, 119, 26, metal(56, 57, [tone(31), tone(60), tone(23)]));
  } else if (model === 'screen') {
    body(-152, -111, 304, 191, 17, '#19222e');
    body(-144, -103, 288, 175, 11, metal(-144, 288, [tone(24), tone(60), tone(34)]));
    body(-171, 79, 342, 19, 8, metal(-171, 342, ['#556170', '#bec7d2', '#54616e']));
  } else if (model === 'shoe') {
    ctx.beginPath();
    ctx.moveTo(-157, 53);
    ctx.quadraticCurveTo(-159, 8, -88, 8);
    ctx.quadraticCurveTo(-30, -2, 5, -62);
    ctx.quadraticCurveTo(38, -82, 74, -37);
    ctx.quadraticCurveTo(108, -28, 119, -57);
    ctx.quadraticCurveTo(153, -35, 150, 56);
    ctx.closePath();
    ctx.fillStyle = metal(-156, 306, [tone(37), tone(68), tone(36)]);
    ctx.fill();
    body(-158, 47, 306, 29, 13, '#e4e0da');
    for (let i = 0; i < 4; i++) body(-19 + i * 17, -15 - i * 9, 33, 5, 2, '#efeae4');
  } else if (model === 'jacket') {
    ctx.beginPath();
    ctx.moveTo(-44, -111);
    ctx.lineTo(-98, -91);
    ctx.quadraticCurveTo(-124, -78, -149, 79);
    ctx.lineTo(-107, 96);
    ctx.lineTo(-82, 18);
    ctx.lineTo(-82, 118);
    ctx.lineTo(82, 118);
    ctx.lineTo(82, 18);
    ctx.lineTo(107, 96);
    ctx.lineTo(149, 79);
    ctx.quadraticCurveTo(124, -78, 98, -91);
    ctx.lineTo(44, -111);
    ctx.closePath();
    ctx.fillStyle = metal(-150, 300, [tone(16), tone(42), tone(25), tone(15)]);
    ctx.fill();
    body(-42, -147, 84, 59, 24, tone(23));
    body(-2, -116, 4, 231, 1, tone(13));
    for (const y of [-61, -18, 25, 68]) body(-77, y, 154, 3, 1, tone(25));
  } else if (model === 'desk') {
    body(-124, -42, 23, 163, 4, '#57483f');
    body(101, -42, 23, 163, 4, '#57483f');
    body(-152, -68, 304, 35, 8, metal(-152, 304, [tone(33), tone(65), tone(42)]));
    body(-146, -65, 292, 6, 3, tone(70));
  } else {
    body(-105, -106, 210, 216, 18, metal(-105, 210, [tone(29), tone(53), tone(32)]));
    body(-105, -106, 210, 24, 9, 'rgba(255, 255, 255, .15)');
    body(-99, -37, 198, 82, 6, 'rgba(12, 19, 34, .31)');
    text(title || 'Покупка', 10, 'bold 24px system-ui', 170);
    body(-46, 26, 92, 3, 1, 'rgba(255, 255, 255, .32)');
  }

  ctx.restore();
}
