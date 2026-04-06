const ImageKit = require('imagekit');

let _imagekit = null;

function getImageKit() {
  if (!_imagekit) {
    _imagekit = new ImageKit({
      publicKey:   process.env.IMAGEKIT_PUBLIC_KEY  || '',
      privateKey:  process.env.IMAGEKIT_PRIVATE_KEY || '',
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || ''
    });
  }
  return _imagekit;
}

module.exports = { getImageKit };
