from flask import Blueprint, render_template, request, flash, redirect, url_for
from .models import Driver
from werkzeug.security import generate_password_hash, check_password_hash
from . import db
from flask_login import login_user, login_required, logout_user, current_user

auth = Blueprint('auth', __name__)

@auth.route('/login', methods=['GET', 'POST'])
def login():
    flash('Welcome to Parking4TheWin!', category='success')
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        driver = Driver.query.filter_by(email=email).first()

        if driver:
            if check_password_hash(driver.password, password):
                login_user(driver, remember=True)
                return redirect(url_for('views.home'))
            else:
                flash('Wrong password! :(', category='error')
        else:
            flash('Email doesn\'t exist!', category='error')
    return render_template("login.html", user=current_user)

@auth.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@auth.route('/sign-up', methods=['GET', 'POST'])
def sign_up():
    if request.method == 'POST':
        email = request.form.get('email')
        first_name = request.form.get('firstName')
        password1 = request.form.get('password1')
        password2 = request.form.get('password2')

        driver = Driver.query.filter_by(email=email).first()

        """
        account creation restrictions:
        - unique email
        - password must be at least 8 characters
        """

        if driver:
            flash('An account has already been created with this email', category='error')
        
        elif len(password1) < 8:
            flash('Password should be at least 8 characters :(', category='error')
            
        elif password1!=password2:
            flash('Passwords don\'t match :(', category='error')
            
        else:
            # add user to database
            new_driver = Driver(email=email, first_name=first_name, password=generate_password_hash(password1,method='sha256'))
            db.session.add(new_driver)
            db.session.commit()
            login_user(new_driver,remember=True)
            flash('Account created! :)', category='success')
            return redirect(url_for('views.home'))

    return render_template("sign_up.html", user=current_user)
