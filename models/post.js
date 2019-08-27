const mongoose = require("mongoose");
mongoose.connect('mongodb://localhost:27017/service', { useNewUrlParser: true });

const postSchema = new mongoose.Schema(
    {
    title: String,
    description: String,
    imgUrl: String,
    user: String
    }
  );
  

  const Post = mongoose.model('posts', postSchema);
  module.exports = Post;