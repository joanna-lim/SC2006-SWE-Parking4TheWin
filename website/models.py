from . import db
from flask_login import UserMixin

class Driver(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True)
    password = db.Column(db.String(150))
    first_name = db.Column(db.String(150))
    vehicle = db.relationship('Vehicle')

class Vehicle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    car_plate = db.Column(db.String(150))
    user_id = db.Column(db.Integer, db.ForeignKey('driver.id'))
