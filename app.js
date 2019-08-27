let express = require('express')
let morgan = require('morgan')
let fetch = require('node-fetch')
let app = express()
const path = require('path');
const User = require('./models/user');
const Post = require('./models/post');
const port = 3101;
const cookieParser = require('cookie-parser');
let session = require('express-session')
const FileStore = require("session-file-store")(session)
const mongoose = require("mongoose");
mongoose.connect('mongodb://localhost:27017/service', { useNewUrlParser: true });
const bcrypt = require("bcrypt")
const multer = require('multer')
const fs = require("fs")


let sessionConfig = {
  secret: 'keyboard cat',
  cookie: {},
  resave: false,
  saveUninitialized: true,
  store: new FileStore({})
}
app.use(express.static('./public'))
app.use(cookieParser());
app.use(session(sessionConfig))
app.use(morgan('dev'))
app.use(express.json());
app.use(express.urlencoded());

const corsMiddleware = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Credentials", "true")
  next();
}

app.use(corsMiddleware)

const storage = multer.diskStorage({
  destination: './public/uploads',
  filename: function(req, file, cb){
    cb(null, file.name + '-' + Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
}).single('image')

app.post('/', function(req, res){
  if(req.session){
  res.json({
    user :req.session.user
  })}
  else{
    res.json({
      user: false
    })
  }
})

app.post("/upload", async function(req, res){
  console.log(req.body)
  upload(req, res, async (err) => {
    if(err){
      console.log(err)
    }
    else {
      console.log(req.session.user);
      let url = "http://localhost:3101" + req.file.path.slice(req.file.path.indexOf("/"))
      let post = new Post({imgUrl: url, user: req.session.user});
      console.log(post)
      await post.save()
      res.json({postId : post.id});
    }
  })
})

app.post("/post", async function(req, res){
  await Post.findOneAndUpdate({_id: req.body.postId}, {$set:{title: req.body.title, description: req.body.description}})
  console.log(await Post.findOne({_id:req.body.postId }))
  res.end()
})

//авторизация
app.post('/reg', async function (req, res) {
  let user = new User({
    login: req.body.login
  })
  user.password = user.createHash(req.body.password);
  req.session.user = user.login;
  await user.save();
  res.json({user:req.session.user})
});

app.get("/getPosts", async function(req, res){
  let posts = await Post.find({user: req.session.user})
  res.json({posts : posts})
})

app.post('/log', async function(req, res) {
  let user = await User.findOne({ login: req.body.login })
    if (user) {
        if (user.checkHash(req.body.password)) {
            req.session.user = user.login
            res.json({
                mes: false,
                user: req.session.user
            });
        }
        else {
            res.json({
                mes: "Неправильный пароль"
            })
        }
    }
    else {
        res.json({
            mes: "неправильный логин"
        })
    }
})

app.get("/logout", function (req, res) {
  req.session.destroy();
  res.end();
})
//instagram
app.get('/instagram', (req, res) => {
  //console.log("k")
  res.redirect('https://api.instagram.com/oauth/authorize/?client_id=63c6a274c99f49bd946935fe18091b62&redirect_uri=http://localhost:3101/instagramtoken&response_type=code')
  //console.log("+++++")
})

app.get('/instagramtoken', async (req, res) => {
  const { code } = req.query
  //console.log(code)
  const data = {
      client_id: '63c6a274c99f49bd946935fe18091b62',
      client_secret: '9302e3334aa549878d4f9ffd83cff32e',
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:3101/instagramtoken',
      code: code
  }
  const formData = Object.keys(data).map((key) => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
  }).join('&');

  //console.log(formData)

const resp = await fetch(`https://api.instagram.com/oauth/access_token`, {
    method: "POST",
    headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
});
const respData = await resp.json()
//console.log(respData)
const { access_token } = respData;
//console.log('acces_token', access_token)

const user = await User.findOne({login: req.session.user})
  user.tokenInst = access_token
  await user.save()

// const posts = await fetch(`https://api.instagram.com/v1/users/self/media/recent/?access_token=${access_token}`)
// const postsData = await posts.json()
// console.log('postData', postsData)
res.redirect('http://localhost:3000/instgram')
})

app.get('/boolInst', async (req,res) => {
    const user = await User.findOne({login: req.session.user})
    let boolToken = false
    const instToken = user.tokenInst
    if(instToken){
      boolToken = true
    }
    else{
      boolToken = false
    }
    const posts = await fetch(`https://api.instagram.com/v1/users/self/media/recent/?access_token=${instToken}`)
const postsData = await posts.json()

    res.json({
      postsData: postsData.data,
      boolToken: boolToken
    })
})

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`)
});

// VKontakte get wall post with stats
app.get('/wallGet', async (req, res) => {
  const resp = await fetch('https://api.vk.com/method/wall.get?owner_id=141938692&filter=owner&count=10&access_token=29adba0535a5509e4a647196148e8f8ca04328b3040e60eba99df3a5861e4aa0b9b0cca2cb87ab0d6319b&v=5.101', {
      headers: {
        "Accept": "application/json"
      }
    });
    const data = await resp.json();
    console.log(data)
    res.json(data.response.items);
});

// VKontakte getting token - step 1
app.get('/oauth', (req, res) => {	
  res.redirect('https://oauth.vk.com/authorize?client_id=7110854&display=page&redirect_uri=http://localhost:3101/vk_code&scope=wall&response_type=code&v=5.101&state=123456')
})
// VKontakte getting token - step 2
app.get('/vk_code', async (req, res) => {
  try {
    const { code } = req.query;
    const response = await fetch(`https://oauth.vk.com/access_token?client_id=7110854&client_secret=YfdX13jLLBZqZz6L2cax&redirect_uri=http://localhost:3101/vk_code&code=${code}`)
    const { access_token, user_id } = await response.json();
    let user = await User.findOne({ login: req.session.user });
    user.vkId = user_id;
    user.vkToken = access_token;
    await user.save();
    console.log(access_token);
    console.log(user_id);
    res.redirect('http://localhost:3000/VK');
  } catch (rerror) {
    res.status(404);
  }
});

// VKontakte checking token
app.get('/vkCheckToken', async (req, res) => {
  let user = await User.findOne({login: req.session.user});
  let checkToken;
  if(user.vkToken) {
    checkToken = true;
  } else {
    checkToken = false;
  }
  res.json({
    checkToken: checkToken
  })
});