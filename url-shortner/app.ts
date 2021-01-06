import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import { UniqueShortIdGeneratorService } from './src/services/UniqueShortIdGenerator.service';
import { mongodb, ObjectId, MongoClient } from 'mongodb';
import validUrl from 'valid-url';
import cors from 'cors';
import dns from 'dns';
import bycrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// mongo db config
const app: Application = express();
const url: string = 'mongodb+srv://harsh:harsh123@cluster0.vjrm0.mongodb.net/<dbname>?retryWrites=true&w=majority';
const dbName: string = 'short_url';

let origin = 'https://compassionate-booth-94e828.netlify.app';

//middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({
    origin: origin
}))

//validate the url, after validation shortern the url and send it to the user and save in the db
app.post('/shorten-url', async (req: Request, res: Response) => {
    console.log(req.body);

    //create connection for client
    let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
    try {
        // check if it is in valid url format
        if (validUrl.isUri(req.body.url)) {
            let url = new URL(req.body.url);

            //check if domain name exists
            dns.lookup(url.hostname, { all: true }, async (error, results) => {
                if (error) {
                    res.status(400).json({
                        message: 'Domain Does not exists',
                    });
                } else {
                    //shorten and insert the url in db
                    let url: string = req.body.url;
                    let db = connection.db(dbName);
                    let urlData = await db.collection('url').findOne({ url: url });
                    if (urlData) {
                        res.json({
                            message: 'Shortern Url Already Exists',
                            data: urlData
                        });
                    } else {
                        let urlShortener: UniqueShortIdGeneratorService = new UniqueShortIdGeneratorService();
                        let shortUrl: string = urlShortener.generateUniqueId();
                        let urlData = {
                            url,
                            shortUrl,
                            clicks: 0
                        };
                        await db.collection('url').insertOne(urlData);
                        res.json({
                            message: "Short url generated Successfully",
                            data: urlData,
                        });
                    }
                    await connection.close();
                }
            });

        } else {
            res.status(400).json({
                message: 'Please enter a valid Url'
            })
        }

    } catch (err) {
        console.log(err);
        res.status(401).json({
            message: 'Some Error Occured',
            data: err
        })
    }
})

// redirect url if the short url has valid url mapping
app.get('/redirect-url/:shortUrl', async (req: Request, res: Response) => {

    //create connection for client
    let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
    try {

        //check url exists
        let db = connection.db(dbName);
        let urlData = await db.collection('url').findOne({ shortUrl: req.params.shortUrl });
        if (urlData) {

            //update click count in db 
            await db.collection('url').updateOne({ _id: urlData._id }, { $set: { clicks: ++urlData.clicks } });
            res.json({
                message: "SuccessFully fetched Redirect Data",
                data: urlData,
            });
        } else {
            res.status(400).json({
                message: 'Invalid short url'
            })
        }
    } catch (err) {
        res.status(401).json({
            message: 'Some Error Occured',
            data: err
        })
    } finally {
        connection.close();
    }
})

// get all url details for the user
app.get('/url-data', async (req: Request, res: Response) => {

    //create connection
    let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
    try {

        // fetch all the url details
        let db = connection.db(dbName);
        let urlData = await db.collection('url').find().toArray();
        res.json({
            message: 'Url details fetched successfully',
            data: urlData
        })
    } catch (err) {
        res.status(401).json({
            message: 'Some Error Occured',
            data: err
        })
    } finally {
        connection.close();
    }
})

app.post('/login-in', async (req, res) => {
    let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
    try {
        let db = connection.db(dbName);
        let user = await db.collection('users').findOne({ email: req.body.email });
        if (user) {
            let isUserAuthenticated = await bycrypt.compare(req.body.password, user.password);
            if (isUserAuthenticated) {
                res.json({
                    message: 'User Authenticated Successfully'
                })
            } else {
                res.status(400).json({
                    message: 'Password is wrong for the provided email',
                })
            }
        } else {
            res.status(400).json({
                message: 'Entered Email does not exists',
            })
        }
    } catch (err) {
        res.status(400).json({
            message: 'Unable to login please enter valid credentials',
        })
    } finally {
        connection.close();
    }
});

app.post('/sign-up', async (req, res) => {
    let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
    try {
        let db = connection.db(dbName);
        let salt = await bycrypt.genSalt(10);
        let hash = await bycrypt.hash(req.body.password, salt);
        req.body.password = hash;
        await db.collection('users').insertOne({ email: req.body.email, password: req.body.password });
        res.json({
            message: 'User Registered Successfully',
        })
    } catch (err) {
        console.log(err);
        res.status(400).json({
            message: 'Unable to register please enter valid details',
        })
    } finally {
        connection.close();
    }
})


app.post('/forget-password', async (req, res) => {
    let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
    try {
        let db = connection.db(dbName);
        let user = await db.collection('users').findOne({ email: req.body.email });

        if (user) {
            // let token = await crypto.randomBytes(20);
            let urlShortener: UniqueShortIdGeneratorService = new UniqueShortIdGeneratorService();
            let token = urlShortener.generateUniqueId({ length: 9 });
            console.log(ObjectId(user._id));
            console.log('forgot', token);
            await db.collection('users').updateOne({ _id: ObjectId(user._id) }, { $set: { resetToken: token, resetTokenExpires: Date.now() + 300000 } });

            let mailBody = `<div>
                <h3>Reset Password</h3>
                <p>Please click the given link to reset your password <a target="_blank" href="${origin}/reset-password.html?key=${encodeURIComponent(token)}"> click here </a></p>
            </div>`

            // create reusable transporter object using the default SMTP transport
            let transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                auth: {
                    user: 'pawarharsh21@gmail.com',
                    pass: 'czpywvbthzaiemrn',
                },
            });

            // send mail with defined transport object
            let info = await transporter.sendMail({
                from: 'noreply@urlShortner.com',
                to: req.body.email,
                subject: "Reset password",
                html: mailBody,
            });

            console.log("Message sent: %s", info.messageId);

            // Preview only available when sending through an Ethereal account
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
            res.json({
                message: `Mail has been sent to ${user.email} with further instructions`,
            })
        } else {
            res.status(400).json({
                message: 'User not found',
            })
        }

    } catch (err) {
        console.log(err);
    } finally {
        connection.close()
    }
})

app.put('/reset', async (req, res) => {
    console.log('reset', decodeURIComponent(req.body.token));
    let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
    try {
        let db = connection.db(dbName);
        let user = await db.collection('users').find({ resetToken: decodeURI(req.body.token), resetTokenExpires: { $gt: Date.now() } }).toArray();
        console.log(user);
        if (user.length !== 0) {
            let salt = await bycrypt.genSalt(10);
            console.log(req.body.password);
            let password = await bycrypt.hash(req.body.password, salt);
            console.log(password);
            let updateInfo = await db.collection('users').updateOne({ _id: ObjectId(user[0]._id) }, { $set: { password: password } });
            // console.log(updateInfo);
            if (updateInfo.modifiedCount > 0) {
                await db.collection('users').updateOne({ _id: ObjectId(user[0]._id) }, { $set: { resetToken: '', resetTokenExpires: '' } });
                let transporter = await nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 587,
                    secure: false,
                    auth: {
                        user: 'pawarharsh21@gmail.com',
                        pass: 'czpywvbthzaiemrn',
                    },
                });

                // send mail with defined transport object
                console.log(user[0].email);
                await transporter.sendMail({
                    from: 'noreply@urlShortner.com',
                    to: user[0].email,
                    subject: "success reset",
                    html: 'Password Reset Successfully',
                });
                res.json({
                    message: "Password reset successfull check your mail for confirmation",
                })
            }
        } else {
            res.status(400).json({
                message: "Failed to update password token invalid",
            })
        }
    } catch (err) {
        console.log(err);

    } finally {
        connection.close();
    }
})

//listen on port
app.listen(process.env.PORT || 3000);
