const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mysql2 = require('mysql2');
const Sequelize = require('sequelize');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');

const saltRounds = 12;
const COOKIE_SECRET = 'Twitter de vos morts';

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(cookieParser(COOKIE_SECRET));
// Keep track of user sessions
app.use(session({
    secret: COOKIE_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Initialize passport, it must come after Express' session() middleware
app.use(passport.initialize());
app.use(passport.session());


app.get('/', (req, res) => {
    if (req.user !== undefined && req.user !== null) {
        console.log(req.user);
        res.render('index', {user: req.user.dataValues});
    } else {
        res.redirect("/register");
    }
});

app.get('/addReview', (req, res) => {
    if (req.user !== undefined && req.user !== null) {
        console.log(req.user);
        res.render('addReview', {user: req.user.dataValues});
    } else {
        res.redirect("/login");
    }
});
app.get('/disconnect', (req, res) => {
    req.user = null;
    res.redirect('login');
});

app.get('/api/getAllReviews', (req, res) => {
    if (req.user !== undefined && req.user !== null) {
        let resp = [];
        Review
            .sync()
            .then(() => {
                return Review.findAll({
                    include: [
                        {
                            model: Comment,
                            include: User,
                        }
                    ]
                });
            })
            .then((articles) => {
                articles.forEach(async function (value, index, array) {
                    let obj = array[index].dataValues;

                    resp.push(obj);
                    if (index === array.length - 1) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify(resp));
                    }
                });
            })
    } else {
        res.send("403");
    }
});

app.post('/api/addArticle', (req, res) => {
    Review
        .sync()
        .then(() => {
            Review.create({
                NomTweet: req.body.NomTweet,
                Review: req.body.Review,
            });
        })
        .then(() => {
            res.redirect("/");
        });
});

app.post('/api/addComment-:idReview', (req, res) => {
    Comment
        .sync()
        .then(() => {
            Comment.create({
                idReview: req.params.idReview,
                idUser: req.user.id,
                comment: req.body.comment,
            });
        })
        .then(() => {
            res.send(200);
        });
});

app.get('/register', (req, res) => {
    // Render the login page
    res.render('register');
});
app.post('/register', (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
        User
            .sync()
            .then(() => {
                User.find({
                    where: {
                        mail: req.body.userName,
                    }
                })
            })
            .then((user) => {
                console.error(user);
                if (user === null || user === undefined) {
                    return User.create({
                        mail: req.body.userName,
                        password: hash,
                        userName: req.body.pseudo,
                    });
                }
            })
            .then((user) => {
                console.log(user);
                user = user.dataValues;
                console.error(user);
                req.login(user, function (err) {
                    if (err) {
                        console.error(err);
                        res.redirect('/register');
                    } else {
                        res.redirect('/');
                    }
                });
            })
            .catch((err) => {
                console.error(err);
                if (err) {
                    res.send(500);
                }
            });
    });
});
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

app.get('/login', (req, res) => {
    // Render the login page
    res.render('login');
});

passport.serializeUser((user, cb) => {
    cb(null, user.mail);
});
passport.deserializeUser((mail, cb) => {
    // Get a user from a cookie's content: his email
    User
        .findOne({where: {mail}})
        .then((user) => {
            cb(null, user);
        })
        .catch(cb);
});

passport.use(new LocalStrategy((mail, password, done) => {
    User
        .findOne({where: {mail}})
        .then(function (user) {
            if (user) {
                bcrypt.compare(password, user.dataValues.password, function (err, res) {
                    if (res === true) {
                        return done(null, user);
                    } else {
                        return done(null, false, {
                            message: 'Invalid credentials'
                        });
                    }
                });

            } else {
                return done(null, false, {
                    message: 'Invalid credentials'
                });
            }
        })
        // If an error occured, report it
        .catch(done);
}));

app.listen(3000);

//DataBase
const db = new Sequelize('twitter', 'root', '', {
    host: 'localhost',
    dialect: 'mysql'
});
const Review = db.define('article', {
    NomTweet: {type: Sequelize.STRING},
    Review: {type: Sequelize.TEXT},
});
const Comment = db.define('comment', {
    idReview: {type: Sequelize.INTEGER},
    idUser: {type: Sequelize.INTEGER},
    comment: {type: Sequelize.TEXT},
});

const User = db.define('user', {
    mail: {type: Sequelize.STRING},
    password: {type: Sequelize.STRING},
    userName: {type: Sequelize.STRING},
});

Review.hasMany(Comment, {foreignKey: 'idReview'});
Comment.belongsTo(Review, {foreignKey: 'idReview'});
User.hasMany(Comment, {foreignKey: 'idUser'});
Comment.belongsTo(User, {foreignKey: 'idUser'});

User.sync();
Comment.sync();
Review.sync();