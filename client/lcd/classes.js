/**
@licence
    Copyright (c) 2020 Alan Chandler, all rights reserved

    Portions of this code is copied from https://codesandbox.io/s/lcd-emulator-gs6vc?from-embed
    and is copyright of the author of this (https://codesandbox.io/u/thatisuday).


    This file is part of Recorder.

    Recorder is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Recorder is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Recorder.  If not, see <http://www.gnu.org/licenses/>.
*/


import { characterMap } from "./characters.js";


// background color
const PIXEL_FILL_COLOR = "#000";

// pad left zeros
const padLeftZeros = (binaryString, desiredLength) => {
  const zerosString = Array(desiredLength)
    .fill("0")
    .join(0);
  const finalString = zerosString + binaryString;

  return finalString.slice(-desiredLength);
};


export class Screen {
  constructor({ elem, rows, columns, pixelSize, pixelColor }) {
    this.rows = rows; // total rows of blocks on the canvas
    this.columns = columns; // total columns of blocks on the canvas
    this.pixelSize = pixelSize; // size of each pixel
    this.pixelColor = pixelColor; // color of pixels
    this.elem = elem; // DOM element to render canvas element

    // render canvas element
    this.render();

    // create block
    this.blocks = [...Array(this.rows * this.columns)].map((_, index) => {
      return new Block({
        canvas: this.canvas,
        index,
        rows: this.rows,
        columns: this.columns,
        pixelSize,
        pixelColor
      });
    });

    // active cursor block
    this.activeBlockIndex = null;
  }

  /*****************************************/

  // get size of the canvas
  static getSize(rows, columns, pixelSize) {
    const blockSize = Block.getSize(pixelSize);
    const blockGutterSize = Block.getGutterSize(pixelSize);

    return {
      width: blockSize.width * columns + blockGutterSize * (columns - 1),
      height: blockSize.height * rows + blockGutterSize * (rows - 1)
    };
  }

  /*****************************************/

  // render canvas
  render() {
    // create canvas element
    this.canvas = document.createElement("canvas");

    // get width of height of canvas
    const { width, height } = Screen.getSize(
      this.rows,
      this.columns,
      this.pixelSize
    );

    // set width and height attributes
    this.canvas.setAttribute("width", width);
    this.canvas.setAttribute("height", height);

    // render canvas
    this.elem.innerHTML = "";
    this.elem.appendChild(this.canvas);
  }

  // write a character in a block using index
  writeCharacter( charCode, blockIndex = 0 ) {
    const block = this.blocks.find(block => block.index === blockIndex);

    // if block is not found with the block index, return
    if (!block) {
      return;
    }

    // write character
    block.writeCharacter(charCode);
  }

  // write string of characters
  writeString (string = '', offset = 0 ) {
    // generate characters from the string
    const characters = string.split('');

    // render each character on blocks
    characters.forEach((character, index) => {
      const charCode = character.charCodeAt(0); // returns a decimal number
      this.writeCharacter(
        charCode,
        index + offset // use block offset to shift the block
      );
    });
  }

  // clear a character
  clearCharacter(blockIndex = 0 ) {
    const block = this.blocks.find(block => block.index === blockIndex);

    // if block is not found with the block index, return
    if (!block) {
      return;
    }

    // write character
    block.clearCharacter();
  }

  // clear the canvas (screen)
  clearScreen() {
    // for each block, clear character
    this.blocks.forEach(block => {
      this.clearCharacter(block.index );
    });
  }

  // toggle cursor blink
  blinkCursor(blockIndex = 0, stop = false ) {
    const block = this.blocks.find(block => block.index === blockIndex);


    // if block is not found with the block index, return
    if (!block) {
      return;
    }

    // if cursor is already active on a block, stop it first
    if (this.activeBlockIndex !== null) {
      const activeBlock = this.blocks.find(block => block.index === this.activeBlockIndex);

      activeBlock.toggleCursorBlink(true);
    }

    // toggle cursor blink on a block
    this.activeBlockIndex = blockIndex;
    block.toggleCursorBlink(stop);
  }
}

export class Block {
  constructor({ canvas, index, rows, columns, pixelSize, pixelColor } = {}) {
    this.canvas = canvas; // canvas element
    this.index = index; // index of the block
    this.rows = rows; // total rows of blocks on the canvas
    this.columns = columns; // total columns of blocks on the canvas
    this.pixelSize = pixelSize; // size of each pixel
    this.pixelColor = pixelColor; // color of pixels

    // set block position
    this.setPosition();

    // create pixel array ( 5 x 8 = 40 pixels )
    this.pixels = [...Array(Block.getPixelCount())].map((_, index) => {
      return new Pixel({
        canvas: this.canvas,
        index,
        size: this.pixelSize,
        color: this.pixelColor,
        offset: { x: this.x, y: this.y }
      });
    });

    // render block
    this.render();
  }

  /*****************************************/

  // number of pixels in row and columns
  static getPixels() {
    return {
      row: 5, // 5 pixels in a row
      column: 8 // 8 pixels in a column
    };
  }

  // get pixel count
  static getPixelCount() {
    const { row, column } = Block.getPixels();
    return row * column;
  }

  // get gutter size : separation between each block
  static getGutterSize(pixelSize) {
    return pixelSize;
  }

  // get size of the block
  static getSize(pixelSize) {
    const { row, column } = Block.getPixels();

    // separation between each pixels
    const pGutter = Pixel.getGutterSize(pixelSize);

    // width and heigh pf entire block
    const width = pixelSize * row + pGutter * (row - 1);
    const height = pixelSize * column + pGutter * (column - 1);

    return { width, height };
  }

  /*****************************************/

  // set position of the block relative to the canvas
  setPosition() {
    // separation between each block
    this.gutter = Block.getGutterSize(this.pixelSize);

    // size of the block
    const { width, height } = Block.getSize(this.pixelSize);

    // horizontal and vertical index
    const hIndex = this.index % this.columns;
    const vIndex = Math.floor(this.index / this.columns);

    // relative X position to the canvas = (horizontal index * width) + (horizontal index * gutter)
    this.x = hIndex * width + hIndex * this.gutter;

    // relative Y position to the canvas = (vertical index * size) + (vertical index * gutter)
    this.y = vIndex * height + vIndex * this.gutter;
  }

  // render block
  render() {
    // render pixels
    this.pixels.forEach(pixel => {
      pixel.render(false);
    });
  }

  // write a character if the `blockIndex` is the current block index
  writeCharacter(charCode) {
    // clear character first
    this.clearCharacter();

    // if `charCode` is number, convert to hexadecimal string
    const hexCode = typeof charCode === 'number'
      ? Number(charCode).toString(16)
      : charCode;

    // get rows (containing active pixels values) from `characterMap`
    const { rows } = characterMap[hexCode];

    // for each element in row, convert value to binary number string
    const binaryRows = rows.map(rowValue => {
      // covert number to binary number
      const binaryString = Number(rowValue).toString(2);

      // pad left zero until total length becomes 5
      return padLeftZeros(binaryString, 5);
    });

    // get bit value of each pixels in the block
    const bitPixels = binaryRows.join("").split("");

    // for each pixel, re-render if pixel value is `1`
    this.pixels.forEach(pixel => {
      const pixelValue = bitPixels[pixel.index];
      pixel.render(pixelValue === "1");
    });
  }

  // clear a character if the `blockIndex` is the current block index
  clearCharacter() {
    // for each pixel, re-render
    this.pixels.forEach(pixel => {
      pixel.render(false);
    });
  }

  // toggle cursort blink
  toggleCursorBlink(stop = false) {
    // get last row of pixels
    const { row } = Block.getPixels();
    const pixels = this.pixels.slice(-row);

    pixels.forEach(pixel => {
      pixel.blink(stop);
    });
  }
}

export class Pixel {
  constructor({ canvas, index, size, color, offset } = {}) {
    this.canvas = canvas; // canvas element
    this.index = index; // index of the pixel
    this.size = size; // size of each pixel
    this.color = color; // color of pixels
    this.offset = offset; // position of the container block from the canvas
    this.gutter = Pixel.getGutterSize(size);

    // set pixel position
    this.setPosition();

    // blink interval
    this.blinkInterval = null;
    this.isVisible = false;
  }

  /*****************************************/

  // get gutter size : separation between each pixels
  static getGutterSize(pixelSize) {
    return Math.ceil(pixelSize / 4);
  }

  /*****************************************/

  // get position of the pixel relative to the block
  setPosition() {
    // horizontal and vertical index
    const hIndex = this.index % 5;
    const vIndex = Math.floor(this.index / 5);

    // relative X position to the block = (horizontal index * size) + (horizontal index * gutter)
    const posX = hIndex * this.size + hIndex * this.gutter;

    // relative Y position to the block = (vertical index * size) + (vertical index * gutter)
    const posY = vIndex * this.size + vIndex * this.gutter;

    // absolute position to the canvas
    this.x = this.offset.x + posX;
    this.y = this.offset.y + posY;
  }

  // render pixel based on `isActive` value
  render(isActive = true) {
    const ctx = this.canvas.getContext("2d");

    // set fill style (color)
    ctx.fillStyle = PIXEL_FILL_COLOR;

    if (isActive) {
      ctx.fillRect(this.x, this.y, this.size, this.size);
      this.isVisible = true;
    } else {
      ctx.clearRect(this.x, this.y, this.size, this.size);
      ctx.fillStyle = "rgba(0,0,0,0.025)"; // dim backlight effecr
      ctx.fillRect(this.x, this.y, this.size, this.size);
      this.isVisible = false;
    }
  }

  // blink pixel
  blink(stop = false) {
    if (stop && this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
      this.render(false); // hide pixel
    } else {
      if (!this.blinkInterval) {
        this.blinkInterval = setInterval(() => {
          if (this.isVisible) {
            this.render(false); // show pixel
          } else {
            this.render(true); // hide pixel
          }
        }, 300);
      }
    }
  }
}
