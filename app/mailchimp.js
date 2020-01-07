const request = require('superagent');
const crypto = require('crypto');
const Promise = require('bluebird');
const co = Promise.coroutine;
const apiEndpoint = process.config.mailchimp.apiEndpoint;
const apiKey = process.config.mailchimp.apiKey;
const listId = process.config.mailchimp.listId;

exports.createMember = co(function *(email) {

  const endpoint = apiEndpoint + "lists/" + listId + "/members";

  // const email = req.body.email;
  // if (!email) {
  //   throw utils.ErrorResponse(400, 'user email required');
  // }

  var response = {
    status: 200,
    msg: "Created"
  }

  try {
    yield request.post(endpoint)
      .set('Content-Type', 'application/json')
      .send({
        email_address: email,
        status: 'subscribed'
      })
      .auth('anystring', apiKey)
  } catch (e) {
    response.status = e.status;
    response.msg = e.response.body.title;
  }

  return response;
});

exports.addTagToMember = co(function *(email, tags) {

  // const email = req.body.email;
  // if (!email) {
  //   throw utils.ErrorResponse(400, 'user email required');
  // }
  //
  // const tags = req.body.tags;
  // if (!tags || !Array.isArray(tags)) {
  //   throw utils.ErrorResponse(400, 'user tags required');
  // }

  const hash = crypto.createHash('md5', 1).update(email.toLowerCase()).digest('hex');
  const endpoint = apiEndpoint + "lists/" + listId + "/members/" + hash + '/tags';
  var mailchimpTags = [];

  tags.forEach( (value, index, array) => {
    const tag = {'name': value, 'status': 'active'};
    mailchimpTags.push(tag);
  })

  console.log("Calling: ["+ endpoint + "]");
  console.log("Tags:");
  console.log(mailchimpTags);

  var response = {
    status: 200,
    msg: "Added tags"
  }

  try {
    yield request.post(endpoint)
      .set('Content-Type', 'application/json')
      .send({
        tags: mailchimpTags
      })
      .auth('anystring', apiKey)
  } catch (e) {
    //console.log(e);
    response.status = e.status;
    response.msg = e;
  }

  return response;
});
