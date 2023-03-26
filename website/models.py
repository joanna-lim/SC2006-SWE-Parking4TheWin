from . import db
from flask_login import UserMixin
import math

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    user_type = db.Column(db.String(50))
    # for drivers
    drivers = db.relationship("Driver")
    vehicles = db.relationship('Vehicle')
    user_claimed_rewards = db.relationship('UserClaimedRewards')
    # for companies
    companys = db.relationship("Company")
    

class Driver(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True)
    password = db.Column(db.String(150))
    first_name = db.Column(db.String(150))
    points = db.Column(db.Integer)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    interested_carpark = db.Column(db.String, db.ForeignKey('carpark.car_park_no'))

class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(150))
    uen = db.Column(db.String(150), unique=True)
    password = db.Column(db.String(150))
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))

class Vehicle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150))
    car_plate = db.Column(db.String(150))
    coe_expiry = db.Column(db.Date)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

class Reward(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reward_title = db.Column(db.String(150))
    reward_expiry = db.Column(db.Date)
    reward_category = db.Column(db.String(50))
    reward_details = db.Column(db.String(10000))
    number_of_rewards = db.Column(db.Integer)
    cost_of_reward = db.Column(db.Float)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id')) # this user_id is the company that created the reward (NOT CLAIMANTS)
    company = db.relationship('User', backref='company')
    user_claimed_rewards = db.relationship('UserClaimedRewards')

class CarPark(db.Model):
    __tablename__ = 'carpark'
    car_park_no = db.Column(db.String, primary_key=True)
    address = db.Column(db.String(150))
    x_coord = db.Column(db.Float)
    y_coord = db.Column(db.Float)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    car_park_type = db.Column(db.String(150))
    type_of_parking_system = db.Column(db.String(150))
    short_term_parking = db.Column(db.String(150))
    free_parking = db.Column(db.String(150))
    night_parking = db.Column(db.Boolean)
    car_park_decks = db.Column(db.Integer)
    gantry_height = db.Column(db.Float)
    car_park_basement = db.Column(db.Boolean)
    total_lots = db.Column(db.Integer)
    lots_available = db.Column(db.Integer)
    lot_type = db.Column(db.String(1))
    lot_info_last_updated = db.Column(db.String(150))
    # jona's additions 
    interested_drivers = db.relationship('Driver', backref='interested_carpark_obj')
    no_of_interested_drivers = db.Column(db.Integer)

class UserClaimedRewards(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    driver_user_id = db.Column(db.Integer, db.ForeignKey('user.id')) # this user IS the claimant - not the company.
    reward_id = db.Column(db.Integer, db.ForeignKey('reward.id'))