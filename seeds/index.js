const mongoose = require("mongoose");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
require('dotenv').config();
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
mbxGeocoding({ accessToken: mapBoxToken });
const axios = require("axios");
const key = process.env.API_KEY;

// const mainAuth = process.env.OWNER_ID;
const { cloudinary } = require("../cloudinary");
const {reverseGeo} = require("../tools/index");
// const mainAuth = '62040b04c7e98a10d8c2d8ac';

//get the model 
const Campground = require('../models/campground');
const User = require('../models/user');

//initial connection error
//const dbUrl = process.env.DB_URL;
const dbUrl = 'mongodb://localhost:27017/yelp-camp';
mongoose.connect(dbUrl)
    .then(() => {
        console.log('CONNECTION MONGO OPEN!')
    })
    .catch((err) => {
        console.log('OH NO MONGO ERROR')
        console.log(err)
    })

//after initial connection error
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

//get seeding data from nps api
const processDatas = async () => {
    try{
        const config = {
            params: 
            {
                api_key : key
            } 
        };
        const res = await axios.get(`https://developer.nps.gov/api/v1/campgrounds?limit=300`, config);
        return res;
    } catch (e) {
        console.log("Connection timeout")
        console.log(e);
    }
}

async function upload(images, camp){
    for(let i =0; i< images.length; i++){
        try {
            //store the result after upload and insert in camp images
            const res = await cloudinary.uploader.upload_large(images[i], {folder: 'YelpCamp'});
            camp.images.push({url: res.secure_url, filename: res.original_filename});
        } catch (e) {
            if(i === 0){
                camp.success = 'fail';
            }
        }
    }
}


const seedDB = async () => {
    // Reset the campgrounds array for the main author in the User collection
    User.findByIdAndUpdate(mainAuth, { $set: { campgrounds: [] } });

    try {
        // Delete all existing campgrounds in the Campground collection
        await Campground.deleteMany({});

        // Process data from an external source
        const res = await processDatas();

        // Iterate over each camp in the processed data
        res.data.data.forEach(async (camp) => {
            // Only proceed if the camp has at least one image
            if (camp.images[0]) {
                // Generate a random price between 10 and 30 if no cost is specified
                const price = Math.floor(Math.random() * 20) + 10;
                
                // Create a new Campground instance
                const campground = new Campground({
                    author: mainAuth,

                    // Determine the location from the address or perform reverse geolocation
                    location: camp.addresses[0] ? 
                        `${camp.addresses[0].line1} ${camp.addresses[0].city} ${camp.addresses[0].stateCode}` : 
                        await reverseGeo([Number.parseFloat(camp.longitude, 10), Number.parseFloat(camp.latitude, 10)]),

                    title: camp.name,
                    description: camp.description,

                    // Use the provided fee cost or the random price
                    price: camp.fees[0] ? camp.fees[0].cost : price,

                    // Set the geographical coordinates
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            camp.longitude,
                            camp.latitude
                        ]
                    }
                });

                // Upload images and associate them with the campground -- we are sending bunch of images
                await upload(camp.images.map(img => img.url), campground);

                // Update the main author's campgrounds array with the new campground
                await User.findByIdAndUpdate(mainAuth, { $push: { campgrounds: campground } });

                // Save the campground to the database if it was successfully created
                if (campground.success !== 'fail') {
                    await campground.save();
                }
            }
        });

    } catch (error) {
        // Log any errors that occur during the seeding process
        console.log("TIMEOUT:", error);
    }
}

// Execute the seedDB function and handle completion or errors
seedDB()
    .then(() => {
        console.log('done');
    })
    .catch(e => {
        console.log("ERROR SEEDING", e);
    });

// const seedDB = async () => {
//     User.findByIdAndUpdate(mainAuth, {$set: {campgrounds: []}});
//     try {
//         await Campground.deleteMany({});


//         const res = await processDatas();
//         res.data.data.forEach( async (camp) => {
//             if(camp.images[0]){
//                 const price = Math.floor(Math.random() * 20) + 10;
//                 const campground = new Campground({
//                 author: mainAuth,
//                 //do reverse lookup here!!!!!from the coordinates if no address available
//                 location: camp.addresses[0] ? 
//                     `${camp.addresses[0].line1} ${camp.addresses[0].city} ${camp.addresses[0].stateCode}`: 
//                     await reverseGeo([Number.parseFloat( camp.longitude, 10), Number.parseFloat( camp.latitude, 10)]),

//                 title: camp.name,

//                 description: camp.description,
//                 //assign a random price if there is no cost
//                 price: camp.fees[0] ? camp.fees[0].cost : price,

//                 geometry: {
//                     type: 'Point',
//                     coordinates: [
//                         camp.longitude,
//                         camp.latitude
//                     ]
//                 }
//                 }) 
//                 await upload(camp.images.map(img => img.url), campground);
//                 await User.findByIdAndUpdate(mainAuth, {$push:{campgrounds: campground}});
//                 if(campground.success !== 'fail') {
//                     await campground.save();
//                 }
//                 // await campground.save();
                
//             }
//         })

//     } catch (error) {
//         console.log("TIMEOUT:", error)
//     }
// }

// seedDB()
//     .then(() => {
//         console.log('done')
//     })
//     .catch(e => {
//         console.log("ERROR SEEDING", e)
//     })