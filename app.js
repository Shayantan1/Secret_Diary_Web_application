//jshint esversion:6

require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const date = require(__dirname + "/date.js");
const path = require('path');
const crypto = require('crypto');
const multer = require("multer");
const {GridFsStorage} = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');

var day = date.getDateAndTime();

const mongoURI="mongodb://localhost:27017/PersonalDiaries";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const conn=mongoose.connection;

let gfs;

conn.once('open', () => {
  // Init stream
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  })
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });

const storySchema = {
    title: String,
    content: String,
    image: String
};

const story1 = mongoose.model("tempStory", storySchema);

const StoryListSchema = {
    name: String,
    diary_data: [storySchema]
};


const List = mongoose.model("Diary_contents", StoryListSchema);

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const userSchema = new mongoose.Schema({
    email: String,
    password: String
});

userSchema.plugin(passportLocalMongoose);


const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/', function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home");
    } else {
        res.render("start");
    }
});

app.get('/login', function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home");
    } else {
        res.render("login");
    }
});

app.get('/register', function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home");
    } else {
        res.render("register", {
            msg: ""
        });
    }
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/home', function(req, res) {

    if (!req.isAuthenticated()) {
        res.redirect("/login");
    } else {
        day = date.getDateAndTime();
        res.render('home', {
            day: day
        });
    }
});

app.get('/diary', function(req, res) {

    if (!req.isAuthenticated()) {
        res.redirect("/login");
    } else {

        day = date.getDateAndTime();

        List.findOne({
            name: req.user.username
        }, function(err, result) {

            if (err) {
                res.render('home'), {
                    day: day,
                    msg: err.message
                }
            }

            if (!result) {
                res.render('home', {
                    day: day,
                    msg: "Nothing in the Diary"
                });
            }
else {
gfs.files.find().toArray((err, files) => {
  // Check if files
  if (!files || files.length === 0) {
    res.render('diary', { files: false });
  } else {
    files.map(file => {
      if (
        file.contentType === 'image/jpeg' ||
        file.contentType === 'image/png'
      ) {
        file.isImage = true;
      } else {
        file.isImage = false;
      }
    });
    res.render('diary', { files: files, stories: result.diary_data });
  }
});
              }
        });
    }
});

app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    // Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      // Read output to browser
      const readstream = gridfsBucket.openDownloadStreamByName(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

app.post('/register', function(req, res) {

    User.register({ username: req.body.username }, req.body.password, function(err, user) {
        if (err) {
            res.render('register', { msg: err.message });
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect('/home');
            });
        }
    });

});


app.post('/login', function(req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect('/home');
            });
        }
    });

});

app.post('/home', upload.single('file'), (req, res) => {

    const user_name = req.user.username;

        day = date.getDateAndTime();

            if (req.file == undefined) {

                if (req.body.todays_secret == "") {
                    res.render('home', {
                        day: day,
                        msg: "Empty Input"
                    });
                } else {

                    List.findOne({
                        name: user_name
                    }, function(err, result) {
                        if (err) {
                            res.render('home', {
                                day: day,
                                msg: err.message
                            });
                        }

                        const story = new story1({
                            title: day,
                            content: req.body.todays_secret
                        });

                        if (!result) {

                            const list = new List({
                                name: user_name,
                                diary_data: story
                            });
                            list.save(function(err) {
                                if (!err) {
                                    res.render('home', {
                                        day: day,
                                        msg: "Diary Updated"
                                    });
                                } else {
                                    res.render('home', {
                                        day: day,
                                        msg: err.message
                                    });
                                }
                            });
                        } else {

                            result.diary_data.push(story);
                            result.save();
                            res.render('home', {
                                day: day,
                                msg: "Diary Updated"
                            });

                        }
                    });

                }


            } else {

                List.findOne({
                    name: user_name
                }, function(err, result) {
                    if (err) {
                        res.render('home', {
                            day: day,
                            msg: err.message
                        });
                    }
                    const story = new story1({
                        title: day,
                        content: req.body.todays_secret,
                        image: req.file.filename
                    });
                    if (!result) {

                        const list = new List({
                            name: user_name,
                            diary_data: story
                        });

                        list.save(function(err) {
                            if (!err) {
                                res.render('home', {
                                    day: day,
                                    msg: "Diary and Image Updated"
                                });
                            } else {
                                res.render('home', {
                                    day: day,
                                    msg: err.message
                                });
                            }
                        });
                    } else {
                        result.diary_data.push(story);
                        result.save();
                        res.render('home', {
                            day: day,
                            msg: "Diary and Image Updated"
                        });
                    }
                });

            }

});




app.listen(3000, function() {
    console.log("Server started on port 3000");
});
