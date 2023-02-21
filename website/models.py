from . import db
from flask_login import UserMixin

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    user_type = db.Column(db.String(20))
    password = db.Column(db.String(150))
    # for drivers
    email = db.Column(db.String(150), unique=True)
    first_name = db.Column(db.String(150))
    vehicle = db.relationship('Vehicle')
    # for companies
    company_name = db.Column(db.String(150))
    company_uen = db.Column(db.String(150))
    
class Vehicle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    car_plate = db.Column(db.String(150))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))


