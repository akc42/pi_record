const usbDetect = require('usb-detection');

const doit = async () => {
  usbDetect.startMonitoring();

  usbDetect.on('add:4661', device => console.log('add', device));
  usbDetect.on('add:46478', device => console.log('add', device));
  usbDetect.on('remove:4661', device => console.log('remove', device));
  usbDetect.on('remove:46478', device => console.log('remove', device));



  //lets see if anthing plugged in
  const devices = await Promise.all([
    usbDetect.find(4661,33296),
    usbDetect.find(46478,40580)
  ])
  console.log('initial setup', devices);
  


} 
const close = async () => {
  console.log('before stopping monitoring');
  await usbDetect.stopMonitoring();
  process.exit(0)

}

doit();
process.on('SIGINT', close);




