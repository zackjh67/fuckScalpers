const fs = require('fs');
const puppeteer = require('puppeteer');
const _ = require('lodash');
const exec = require('await-exec');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

// TODO build similar sku checker bot that finds newly listed products with certain search filter, say 3080/3090
const knownProducts = [];

// bestbuy uses sku numbers to identify products
const allProductLinks = [
  'https://www.newegg.com/evga-geforce-rtx-3090-24g-p5-3987-kr/p/N82E16814487526',
  'https://www.newegg.com/msi-geforce-rtx-3080-rtx-3080-ventus-3x-10g/p/N82E16814137600',
  'https://www.newegg.com/asus-geforce-rtx-3080-rog-strix-rtx3080-o10g-gaming/p/N82E16814126457',
  'https://www.newegg.com/msi-geforce-rtx-3080-rtx-3080-gaming-x-trio-10g/p/N82E16814137597',
  'https://www.newegg.com/msi-geforce-rtx-3080-rtx-3080-ventus-3x-10g-oc/p/N82E16814137598',
  'https://www.newegg.com/gigabyte-geforce-rtx-3080-gv-n3080aorus-x-10gd/p/N82E16814932345',
  'https://www.newegg.com/msi-geforce-rtx-3090-rtx-3090-ventus-3x-24g-oc/p/N82E16814137596',
  'https://www.newegg.com/evga-geforce-rtx-3080-10g-p5-3881-kr/p/N82E16814487522',
  'https://www.newegg.com/evga-geforce-rtx-3080-10g-p5-3883-kr/p/N82E16814487521',
  'https://www.newegg.com/msi-geforce-rtx-3090-rtx-3090-gaming-x-trio-24g/p/N82E16814137595',
  'https://www.newegg.com/gigabyte-geforce-rtx-3090-gv-n3090aorus-x-24gd/p/N82E16814932340',
  'https://www.newegg.com/gigabyte-geforce-rtx-3080-gv-n3080gaming-oc-10gd/p/N82E16814932329',
  'https://www.newegg.com/gigabyte-geforce-rtx-3080-gv-n3080vision-oc-10gd/p/N82E16814932337',
  'https://www.newegg.com/msi-geforce-rtx-3080-rtx3080-suprim-x-10g/p/N82E16814137609',
  'https://www.newegg.com/gigabyte-geforce-rtx-3090-gv-n3090gaming-oc-24gd/p/N82E16814932327',
  'https://www.newegg.com/gigabyte-geforce-rtx-3080-gv-n3080eagle-oc-10gd/p/N82E16814932330',
  'https://www.newegg.com/gigabyte-geforce-rtx-3080-gv-n3080aorus-m-10gd/p/N82E16814932336',
  'https://www.newegg.com/evga-geforce-rtx-3080-10g-p5-3885-kr/p/N82E16814487520',
  'https://www.newegg.com/evga-geforce-rtx-3080-10g-p5-3895-kr/p/N82E16814487519',
  'https://www.newegg.com/gigabyte-geforce-rtx-3090-gv-n3090aorus-m-24gd/p/N82E16814932341',
  'https://www.newegg.com/gigabyte-geforce-rtx-3080-gv-n3080aorusx-w-10gd/p/N82E16814932372',
  'https://www.newegg.com/gigabyte-geforce-rtx-3090-gv-n3090aorusx-w-24gd/p/N82E16814932387',
  'https://www.newegg.com/evga-geforce-rtx-3090-24g-p5-3973-kr/p/N82E16814487523',
  'https://www.newegg.com/gigabyte-geforce-rtx-3080-gv-n3080eagle-10gd/p/N82E16814932367',
  'https://www.newegg.com/evga-geforce-rtx-3090-24g-p5-3985-kr/p/N82E16814487525',
  'https://www.newegg.com/evga-geforce-rtx-3090-24g-p5-3975-kr/p/N82E16814487524',
  'https://www.newegg.com/gigabyte-geforce-rtx-3090-gv-n3090eagle-oc-24gd/p/N82E16814932328',
  'https://www.newegg.com/msi-geforce-rtx-3080-rtx-3080-suprim-10g/p/N82E16814137634?&quicklink=true',
  'https://www.newegg.com/msi-geforce-rtx-3090-rtx-3090-ventus-3x-24g/p/N82E16814137599',
  'https://www.newegg.com/gigabyte-geforce-rtx-3090-gv-n3090eagle-24gd/p/N82E16814932366',
];
const productsToWatch = ['https://www.newegg.com/evga-geforce-rtx-3090-24g-p5-3975-kr/p/N82E16814487524', 'https://www.newegg.com/asus-geforce-rtx-3090-tuf-rtx3090-24g-gaming/p/N82E16814126455', 'https://www.newegg.com/gigabyte-geforce-rtx-3090-gv-n3090gaming-oc-24gd/p/N82E16814932327', 'https://www.newegg.com/evga-geforce-rtx-3090-24g-p5-3987-kr/p/N82E16814487526?&quicklink=true', 'https://www.newegg.com/msi-geforce-rtx-3090-rtx-3090-ventus-3x-24g/p/N82E16814137599'];

const addToCartBtnSelector = '.btn-primary.btn-wide';
const checkoutSelector = "btn-primary";
const dumbPopupSelector = "btn-primary";
const dontSeeDumbPopupAgainSelector = "btn-primary";
const closeDumbPopupAgainSelector = "btn-primary";
const isNotNewSelector = ".product-condition";
const sellerNameSelector = ".product-seller";

// change this. Uses service called Alertzy for push notifications to your mobile phone
// https://alertzy.app/
const alertzyAccountKey = '';

// TODO check for 'are u human' window and navigate again when that shit happens

const refreshInterval = 13000;



function buildAlertzy(title, message, link, priority) {
  if (!alertzyAccountKey.length) return 'echo Alertzy not set up';
  return `curl -s --form-string "priority=${priority || 0}" --form-string "group=Newegg" --form-string "accountKey=${alertzyAccountKey}" --form-string "title=${machineTitle}: ${title}" --form-string "message=${message}" ${(link && '--form-string "link=' + link + '"') || ''} https://alertzy.app/send
`
}

const machineTitle = 'Computer 1';

async function kmap(collection, fn) {
  return new Promise(async function (resolve) {
    const newCollection = [];
    for (let i=0; i<collection.length; i+=1) {
      newCollection.push(await fn(collection[i], i));
    }
    resolve(newCollection);
  });
}

async function keach(collection, fn) {
  return new Promise(async function (resolve) {
    for (let i=0; i<collection.length; i+=1) {
      await fn(collection[i], i);
    }
    resolve();
  });
}

function ktimeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function now() {
  const currentDate = new Date();
  const dateTime = "" + currentDate.getDate() + "/"
    + (currentDate.getMonth()+1)  + "/"
    + currentDate.getFullYear() + " @ "
    + currentDate.getHours() + ":"
    + currentDate.getMinutes() + ":"
    + currentDate.getSeconds();

  return dateTime;
}

// logic for actually checking the stock
async function doCheck(shouldRun, page, destUrl, initialStagger) {
  let canCheckout = false;
  let hasStaggered = false;

  while(!go) {
    await ktimeout(2000);
  }

  if (go && !hasStaggered) {
    console.log(`initial stagger for ${initialStagger/1000} seconds!`);
    // stagger cuz
    await ktimeout(initialStagger);
  }

  while(shouldRun) {
    try {
      const cartButtonArr = await page.$$(`${addToCartBtnSelector}`);

      // wait 2 seconds for shit to load
      console.log(`${destUrl} waiting 2 seconds for full page load`);
      await ktimeout(2000);

      // if (destUrl === 'https://www.newegg.com/deepcool-gamer-storm-liquid-cooling-system/p/N82E16835856134?Item=N82E16835856134&cm_sp=Homepage_SS-_-P0_35-856-134-_-02262021&quicklink=true') {
      //   e.emit('start', {});
      // }


      const inStock = cartButtonArr.length;
      if (inStock) {
        // TODO TODO TODO delete global shitty check variable and use worker threads instead eventually!!!!!!!!!
        // stall if another process is checking out
        if (someoneElseCheckingOut) {
          console.log(`FUCK!!!!!!!!!!: ${destUrl} cant check out!!!!!`);
        }
        while(someoneElseCheckingOut){
          await ktimeout('2000');
        }

        // weed out bad candidates first
        const isNotNewSelect = await page.$$(`${isNotNewSelector}`);
        let isNew = true;
        if (isNotNewSelect.length) {
          console.log(`${destUrl} product condition is not new`);
          isNew = false;
        }

        const sellerNameEl = await page.$$(`${sellerNameSelector}`);
        let sellerNamePresent, isNewEgg;
        if (sellerNameEl.length) {
          sellerNamePresent = sellerNameEl[0];
        }
        if (sellerNamePresent) {
          console.log('fuckin got here lol');
          const sellerNameHtml = await page.evaluate(e => e.innerHTML, sellerNamePresent);
          console.log('the text content!!!!!!!!!: %o', sellerNameHtml);
          const newEggTxt = sellerNameHtml.search('<strong>Newegg</strong>');
          if (newEggTxt !== -1) {
            isNewEgg = true;
          }
        }



        if (isNew && isNewEgg) {
          // trying to checkout. tell others to pause
          someoneElseCheckingOut = true;
          // send STOP signal so we don't buy a shitload of cards at once
          console.log(`$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ ${destUrl} in stock at: %o $$$$$$$$$$$$$$$$$$$$$$$$$$$$$`, now());
          const cartButton = cartButtonArr[0];
          // TODO attempt checkout process here. If it fails a manual restart may be needed I'm not sure.
          try{
            // wait a bit to click so it doesn't think ur a bot i guess
            await ktimeout(2000);
            await cartButton.click();
            await exec(
              buildAlertzy('NEWEGG', `Attempting check out at: ${destUrl}`)
            );

            // nav to cart cuz they like to pop dumb shit up
            await page.goto('https://secure.newegg.com/shop/cart');

            // wait for stupid fucking mask thing to popup
            await ktimeout(1500);
            const stopShowingMeThisShit = await page.$('#masks_do_not_show');
            if (stopShowingMeThisShit) {
              await page.$eval('#masks_do_not_show', el => el.value = true);
            }
            const xButtons = await page.$$('.close');
            if (xButtons.length) {
              const xButton = xButtons[0];
              await xButton.click();
            }

            const checkoutBtn = (await page.$$(addToCartBtnSelector))[0];
            await checkoutBtn.click();

            // TODO only perform these steps if it takes u to the signin page!!!!!!!!!!!!

            // const emailInput = await page.$('#labeled-input-signEmail');
            // await page.$eval('#labeled-input-signEmail', el => el.value = 'EMAIL');
            //
            // const signInBtn = await page.$('#signInSubmit');
            // await signInBtn.click();
            //
            //
            // await page.$eval('#labeled-input-password', el => el.value = 'PASSSWORD');
            // const signInBtn2 = await page.$('#signInSubmit');
            // await signInBtn2.click();

            // wait for buttons to load i guess
            await ktimeout(2500);
            let paymentButtons = await page.$$('.checkout-step-action-done');
            let continueToPaymentBtn;
            let reviewButton;

            console.log('here are all the payment buttons i guess!!: %o', paymentButtons.length);
            await keach(paymentButtons, async (btn) => {
              const buttonTxt = await page.evaluate(e => e.innerText, btn);
              console.log('here is the button txt lol: %o', buttonTxt);
              if (buttonTxt.toUpperCase() === 'Continue to payment'.toUpperCase()) {
                console.log('found continue to payment button');
                continueToPaymentBtn = btn;
                await continueToPaymentBtn.click();
              }
            });

            // do it all again for the other button lol
            await ktimeout(2500);
            paymentButtons = await page.$$('.checkout-step-action-done');

            console.log('here are all the payment buttons i guess!!: %o', paymentButtons.length);
            await keach(paymentButtons, async (btn) => {
              const buttonTxt = await page.evaluate(e => e.innerText, btn);
              console.log('here is the button txt lol: %o', buttonTxt);
              if (buttonTxt.toUpperCase() === 'Review your order'.toUpperCase()) {
                console.log('found review order button');
                reviewButton = btn;
                await reviewButton.click();
              }
            });

            await ktimeout(1000);

            console.log('###### ALRT ABOUIT TO PLACE THE FUCKING ORDER!!!!!!!! ALRT ##################');
            const placeFuckingOrderButton = (await page.$$(addToCartBtnSelector))[0];
            await placeFuckingOrderButton.click();

            buildAlertzy('NEWEGG PURCHASE COMPLETED $$$$$$$$$$$', `${destUrl}`);

            shouldRun = false;

          } catch(e) {
            buildAlertzy('NEWEGG checkout failed', `${destUrl} with ERROR ${e.toString()}`);
            // if the checkout failed, restart everyone, else hold
            someoneElseCheckingOut = false;
          }
        }
      }

      // wait 10 seconds then refresh
      console.log(`waiting 10 seconds to refresh ${destUrl}`);
      // TODO add random seconds modifier to refreshinterval second so it seems less bott-ey and predictable
      await ktimeout(refreshInterval);
      if (!inStock) {
        console.log(`${destUrl} not in stock. refreshing. ${now()}`);
        // refresh page if out of stock
        await page.reload(destUrl);
      } else {
        shouldRun = false;
      }
    } catch(e) {
      shouldRun = false;
      console.log('fuckin error!!!: %o', e);
      await exec(
        buildAlertzy(destUrl, `Error! ${e.toString()}`)
      );
    }
  }
}


// TODO kill these shitty racy variables when u can lol
let go = false;
let someoneElseCheckingOut = false;














// the new bot lol im so lazy
let staggerTime = argv.stagger * 1000 || 0;
let botNum = argv.botNum;
let keepRunning = true;
let gpuListHref = 'https://www.newegg.com/p/pl?N=100007709%20601357248%20601357247%2050001402%2050001312%2050001315%2050001314%204814%20601303642%20601183677';
const itemSelector = '.item-info';
const itemLinkSelector = '.item-title';
const promoSelector = '.item-promo';
(async () => {
  console.log(`YAR! I BE BOT ${botNum}`);

  // stagger time so we can have checks at different times for diff bots
  console.log(`staggering for ${staggerTime/1000} seconds`);
  await ktimeout(staggerTime);


  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.setViewport({ width: 1280, height: 1024 });
  await page.goto(gpuListHref);
  let lastNumItems;

  // flagged for VPN I think. lets wait a min incase i have to do captcha
  // await ktimeout(60000);

  while(keepRunning) {
    try{
      const items = await page.$$(itemSelector);
      lastNumItems = items.length;
      if (!items.length) {
        if (lastNumItems === 0) {
          console.log('no items after refresh still. something is wrong');
          await exec(
              buildAlertzy('Newegg ERROR', `Bot ${botNum} had error ${e.toString()}`, undefined, 0)
          );
          keepRunning = false;
        } else {
          // lets refresh and see if that helps things
          await page.reload(gpuListHref);
        }
      } else {
        await keach(items, async (item) => {
          const titleContainer = (await item.$$(itemLinkSelector))[0]
          const itemHref = await page.evaluate(anchor => anchor.getAttribute('href'), titleContainer);
          const itemDescription = await page.evaluate(el => el.innerText, titleContainer);
          if (!itemHref) {
            console.log('no href? we have a problem.');
            await exec(
                buildAlertzy('Newegg ERROR (No Href)', `Error at ${now()} sry check the logs`, undefined, 0)
            );
          }
          const promoContainers = await item.$$(promoSelector);
          let inStock = true;
          await keach(promoContainers, async (pc) => {
            const containerTxt = await page.evaluate(el => el.innerText, pc);
            if (containerTxt.toUpperCase() === 'OUT OF STOCK') {
              inStock = false;
            }
          });
          if (inStock && itemHref) {
            console.log(`item ${itemDescription} in stock!!!`);
            await exec(
                buildAlertzy(`IN STOCK: ${itemDescription}`, `Bot ${botNum} found this in stock at ${now()}`, itemHref, 2)
            );
          }
        })
      }

      // wait 2 mins and then refresh
      const randomMs = Math.floor(Math.random() * 2500);
      await ktimeout(120000 + randomMs);
      await page.reload(gpuListHref);
    } catch(e) {
      console.log(`${now()} ################################ fuckin error!!!: %o`, e);
      await exec(
          buildAlertzy('Newegg ERROR', `Error at ${now()} sry check the logs`, undefined, 0)
      );
      keepRunning = false;
    }
  }





















  // give me a minute to sign in and then click the fucking masks checkbox omg
  // await ktimeout(90000);
  //
  // // open up chromium instances for each sku to watch
  // keach(productsToWatch, async (href, i) => {
  //   let staggerSeconds = 3000 * i;
  //   if (i !== 0) {
  //     console.log(`${href} waiting ${staggerSeconds/1000} seconds to start executing`);
  //     await ktimeout(staggerSeconds);
  //   }
  //
  //   const page = await browser.newPage();
  //   await page.setDefaultNavigationTimeout(0);
  //   await page.setViewport({ width: 1280, height: 1024 });
  //   const destUrl = href;
  //
  //   // TODO write these to a log eventually i guesss
  //   console.log(`Pinging item: ${href}\n`);
  //   await page.goto(destUrl);
  //
  //   let shouldRun = true;
  //   doCheck(shouldRun, page, href, staggerSeconds);
  //
  //   // we need all the pages loaded and functions running to accurately detect signals so wait for that to happen to
  //   // start everything off
  //   if (i === productsToWatch.length - 1) {
  //     console.log(`######## NOTICE ######### all pages loaded. Start checking every ${staggerSeconds/1000} seconds!`);
  //     go = true;
  //     // (async function start() {
  //     //   console.log('inside async and starting??');
  //     //   controllerEev.emit('start', {
  //     //     stagger: staggerSeconds,
  //     //   });
  //     // })();
  //   }
  // });

  console.log('fuckin done');
})();

// error if u cant add to ur cart
// i think this was actually caused by a fucking popup blocker
/*
* <div class="c-alert c-alert-level-danger"><div class="c-alert-icon"><i><svg aria-hidden="true" role="img" viewBox="0 0 100 100" fill="#fff" height="24" width="24"><use href="/~assets/bby/_img/int/plsvgdef-frontend/svg/alert-octagon.svg#alert-octagon" xlink:href="/~assets/bby/_img/int/plsvgdef-frontend/svg/alert-octagon.svg#alert-octagon"></use></svg><span class="sr-only" tabindex="-1">Error</span></i></div><div class="c-alert-content"><p>There was a problem adding your product to cart.</p></div></div>
*
* */
