from . import db
from flask_login import UserMixin

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    password = db.Column(db.String(150))
    user_type = db.Column(db.String(50))
    # for drivers
    email = db.Column(db.String(150), unique=True)
    first_name = db.Column(db.String(150))
    vehicle = db.relationship('Vehicle')
    # for companies
    company_name = db.Column(db.String(150))
    uen = db.Column(db.String(150), unique=True)

class Vehicle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    car_plate = db.Column(db.String(150))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))



