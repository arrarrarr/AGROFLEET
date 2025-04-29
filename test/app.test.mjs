import chai from 'chai';
import chaiHttp from 'chai-http';
import app from 'C:\Users\artem\Desktop\diplom_sait/server.js';  

chai.use(chaiHttp);
const { expect } = chai;

describe('User API', () => {
  it('should create a new user', (done) => {
    chai.request(app)
      .post('/users')
      .send({ name: 'John Doe', email: 'john@example.com' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('id');
        expect(res.body.name).to.equal('John Doe');
        done();
      });
  });

  it('should fetch all users', (done) => {
    chai.request(app)
      .get('/users')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });
});
